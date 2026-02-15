import Cocoa
import Foundation

// MARK: - Config

struct AppConfig: Codable {
    let projectRoot: String
    let bunPath: String
    let gatewayPort: Int
    let mcpPort: Int
    var version: String?
}

func loadConfig() -> AppConfig? {
    let configDir = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/AI-Assistant")
    let configFile = configDir.appendingPathComponent("config.json")
    guard let data = try? Data(contentsOf: configFile) else { return nil }
    return try? JSONDecoder().decode(AppConfig.self, from: data)
}

func loadEnv(projectRoot: String) -> [String: String] {
    var env = ProcessInfo.processInfo.environment
    let envFile = "\(projectRoot)/.env"
    if let envContents = try? String(contentsOfFile: envFile, encoding: .utf8) {
        for line in envContents.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
            let parts = trimmed.split(separator: "=", maxSplits: 1)
            if parts.count == 2 {
                env[String(parts[0])] = String(parts[1])
            }
        }
    }
    return env
}

// MARK: - Server Manager

class ServerManager {
    private var gatewayProcess: Process?
    private var webProcess: Process?
    private var isRunning = false
    var onStatusChange: ((Bool) -> Void)?

    private var healthTimer: Timer?
    private var config: AppConfig?

    init() {
        self.config = loadConfig()
    }

    var running: Bool { isRunning }

    func start() {
        guard let config = self.config else {
            showAlert("Config not found", "Could not read ~/Library/Application Support/AI-Assistant/config.json")
            return
        }

        let projectRoot = config.projectRoot
        let entrypoint = "\(projectRoot)/apps/gateway/src/index.ts"

        guard FileManager.default.fileExists(atPath: entrypoint) else {
            showAlert("Entry point not found", "Expected: \(entrypoint)")
            return
        }

        let env = loadEnv(projectRoot: projectRoot)
        let webPort = config.gatewayPort + 2

        // Start gateway
        let gw = Process()
        gw.executableURL = URL(fileURLWithPath: config.bunPath)
        gw.arguments = ["run", "--watch", entrypoint]
        gw.currentDirectoryURL = URL(fileURLWithPath: projectRoot)
        gw.environment = env
        gw.standardOutput = FileHandle.nullDevice
        gw.standardError = FileHandle.nullDevice

        // Start web UI (vite dev server)
        let web = Process()
        web.executableURL = URL(fileURLWithPath: config.bunPath)
        web.arguments = ["run", "--filter", "@ai-assistant/web", "dev", "--", "--port", String(webPort)]
        web.currentDirectoryURL = URL(fileURLWithPath: projectRoot)
        web.environment = env
        web.standardOutput = FileHandle.nullDevice
        web.standardError = FileHandle.nullDevice

        do {
            try gw.run()
            gatewayProcess = gw

            try web.run()
            webProcess = web

            isRunning = true
            onStatusChange?(true)
            startHealthPolling()
        } catch {
            showAlert("Failed to start server", error.localizedDescription)
        }
    }

    func stop() {
        stopHealthPolling()
        terminateProcess(&gatewayProcess)
        terminateProcess(&webProcess)
        isRunning = false
        onStatusChange?(false)
    }

    private func terminateProcess(_ proc: inout Process?) {
        guard let p = proc, p.isRunning else {
            proc = nil
            return
        }

        p.terminate() // SIGTERM

        let ref = p
        // SIGKILL after 5s if still running
        DispatchQueue.global().asyncAfter(deadline: .now() + 5) {
            if ref.isRunning {
                kill(ref.processIdentifier, SIGKILL)
            }
        }

        DispatchQueue.global().async {
            ref.waitUntilExit()
        }

        proc = nil
    }

    private func startHealthPolling() {
        healthTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.checkHealth()
        }
    }

    private func stopHealthPolling() {
        healthTimer?.invalidate()
        healthTimer = nil
    }

    private func checkHealth() {
        guard let config = self.config else { return }
        let url = URL(string: "http://localhost:\(config.gatewayPort)/health")!
        let task = URLSession.shared.dataTask(with: url) { [weak self] _, response, error in
            DispatchQueue.main.async {
                let httpResponse = response as? HTTPURLResponse
                let healthy = error == nil && httpResponse?.statusCode == 200
                let wasRunning = self?.isRunning ?? false
                self?.isRunning = healthy
                if wasRunning != healthy {
                    self?.onStatusChange?(healthy)
                }
            }
        }
        task.resume()
    }

    func showAlert(_ title: String, _ message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.runModal()
    }
}

// MARK: - App Delegate

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var serverManager: ServerManager!
    var statusMenuItem: NSMenuItem!
    var toggleMenuItem: NSMenuItem!
    var webUIItem: NSMenuItem!
    var logsItem: NSMenuItem!
    var updateItem: NSMenuItem!
    var versionItem: NSMenuItem!
    var config: AppConfig?
    var updateTimer: Timer?
    var remoteVersion: String?

    private let versionURL = "https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/VERSION"
    private let installCommand = "curl -fsSL https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/tools/install.sh | bash"

    func applicationDidFinishLaunching(_ notification: Notification) {
        config = loadConfig()
        serverManager = ServerManager()

        // Create status bar item
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "\u{1F916}" // 🤖

        buildMenu()

        serverManager.onStatusChange = { [weak self] running in
            self?.updateMenu(running: running)
        }

        // Auto-start server if flagged (e.g. after an update where server was running)
        let configDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/AI-Assistant")
        let autoStartFlag = configDir.appendingPathComponent(".autostart")
        if FileManager.default.fileExists(atPath: autoStartFlag.path) {
            try? FileManager.default.removeItem(at: autoStartFlag)
            serverManager.start()
        }

        // Check for updates on launch and every 60 minutes
        checkForUpdate()
        updateTimer = Timer.scheduledTimer(withTimeInterval: 3600, repeats: true) { [weak self] _ in
            self?.checkForUpdate()
        }
    }

    func buildMenu() {
        let menu = NSMenu()

        statusMenuItem = NSMenuItem(title: "\u{1F534} Stopped", action: nil, keyEquivalent: "")
        statusMenuItem.isEnabled = false
        menu.addItem(statusMenuItem)

        toggleMenuItem = NSMenuItem(title: "Start Server", action: #selector(toggleServer), keyEquivalent: "s")
        toggleMenuItem.target = self
        menu.addItem(toggleMenuItem)

        menu.addItem(NSMenuItem.separator())

        webUIItem = NSMenuItem(title: "Open Web UI", action: #selector(openWebUI), keyEquivalent: "w")
        webUIItem.target = self
        webUIItem.isEnabled = false
        menu.addItem(webUIItem)

        logsItem = NSMenuItem(title: "Open Logs", action: #selector(openLogs), keyEquivalent: "l")
        logsItem.target = self
        logsItem.isEnabled = false
        menu.addItem(logsItem)

        menu.addItem(NSMenuItem.separator())

        updateItem = NSMenuItem(title: "Update Available", action: #selector(runUpdate), keyEquivalent: "u")
        updateItem.target = self
        updateItem.isHidden = true
        menu.addItem(updateItem)

        let configItem = NSMenuItem(title: "Edit Config", action: #selector(editConfig), keyEquivalent: ",")
        configItem.target = self
        menu.addItem(configItem)

        menu.addItem(NSMenuItem.separator())

        let currentVersion = config?.version ?? "unknown"
        versionItem = NSMenuItem(title: "v\(currentVersion)", action: nil, keyEquivalent: "")
        versionItem.isEnabled = false
        menu.addItem(versionItem)

        let quitItem = NSMenuItem(title: "Quit", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    func updateMenu(running: Bool) {
        if running {
            statusMenuItem.title = "\u{1F7E2} Running"
            toggleMenuItem.title = "Stop Server"
        } else {
            statusMenuItem.title = "\u{1F534} Stopped"
            toggleMenuItem.title = "Start Server"
        }
        webUIItem.isEnabled = running
        logsItem.isEnabled = running
    }

    @objc func toggleServer() {
        if serverManager.running {
            serverManager.stop()
        } else {
            serverManager.start()
        }
    }

    @objc func openWebUI() {
        let port = config?.gatewayPort ?? 4310
        let webPort = port + 2
        NSWorkspace.shared.open(URL(string: "http://localhost:\(webPort)")!)
    }

    @objc func openLogs() {
        let port = config?.gatewayPort ?? 4310
        let webPort = port + 2
        NSWorkspace.shared.open(URL(string: "http://localhost:\(webPort)/logs")!)
    }

    @objc func editConfig() {
        guard let config = self.config else { return }
        let envPath = "\(config.projectRoot)/.env"
        let fileURL = URL(fileURLWithPath: envPath)
        let textEditURL = URL(fileURLWithPath: "/System/Applications/TextEdit.app")
        let openConfig = NSWorkspace.OpenConfiguration()
        NSWorkspace.shared.open([fileURL], withApplicationAt: textEditURL, configuration: openConfig)
    }

    func checkForUpdate() {
        guard let url = URL(string: versionURL) else { return }
        let task = URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let self = self, error == nil,
                  let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200,
                  let data = data,
                  let remote = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  remote.range(of: #"^\d+\.\d+\.\d+$"#, options: .regularExpression) != nil
            else { return }
            DispatchQueue.main.async {
                self.remoteVersion = remote
                let local = self.config?.version ?? "0.0.0"
                if remote != local {
                    self.updateItem.title = "Update Available (v\(remote))"
                    self.updateItem.isHidden = false
                } else {
                    self.updateItem.isHidden = true
                }
            }
        }
        task.resume()
    }

    @objc func runUpdate() {
        let wasRunning = serverManager.running
        if wasRunning {
            serverManager.stop()
        }

        // Write a temporary shell script to avoid escaping issues
        let configDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/AI-Assistant")
        let autoStartFlag = configDir.appendingPathComponent(".autostart")

        // If the server was running, write a flag so the app auto-starts the server after relaunch
        if wasRunning {
            try? "1".write(to: autoStartFlag, atomically: true, encoding: .utf8)
        }

        let tmpScript = NSTemporaryDirectory() + "ai-assistant-update.sh"
        var scriptLines = "#!/usr/bin/env bash\nset -euo pipefail\n"
        scriptLines += "\(installCommand)\n"
        scriptLines += "echo ''\n"
        scriptLines += "echo 'Done. You can close this window.'\n"

        try? scriptLines.write(toFile: tmpScript, atomically: true, encoding: .utf8)
        try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: tmpScript)

        let appleScript = """
        tell application "Terminal"
            activate
            do script "\(tmpScript)"
        end tell
        """

        if let appleScriptObj = NSAppleScript(source: appleScript) {
            var errorInfo: NSDictionary?
            appleScriptObj.executeAndReturnError(&errorInfo)
        }

        // Quit so the installer can replace files
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            NSApplication.shared.terminate(nil)
        }
    }

    @objc func quitApp() {
        serverManager.stop()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            NSApplication.shared.terminate(nil)
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        if serverManager.running {
            serverManager.stop()
        }
    }
}

// MARK: - Main

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
