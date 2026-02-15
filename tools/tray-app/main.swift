import Cocoa
import Foundation

// MARK: - Config

struct AppConfig: Codable {
    let projectRoot: String
    let bunPath: String
    let gatewayPort: Int
    let mcpPort: Int
}

func loadConfig() -> AppConfig? {
    let configDir = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/AI-Assistant")
    let configFile = configDir.appendingPathComponent("config.json")
    guard let data = try? Data(contentsOf: configFile) else { return nil }
    return try? JSONDecoder().decode(AppConfig.self, from: data)
}

// MARK: - Server Manager

class ServerManager {
    private var process: Process?
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

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: config.bunPath)
        proc.arguments = ["run", "--watch", entrypoint]
        proc.currentDirectoryURL = URL(fileURLWithPath: projectRoot)

        // Load .env into process environment
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
        proc.environment = env

        proc.standardOutput = FileHandle.nullDevice
        proc.standardError = FileHandle.nullDevice

        do {
            try proc.run()
            process = proc
            isRunning = true
            onStatusChange?(true)
            startHealthPolling()
        } catch {
            showAlert("Failed to start server", error.localizedDescription)
        }
    }

    func stop() {
        stopHealthPolling()
        guard let proc = process, proc.isRunning else {
            isRunning = false
            onStatusChange?(false)
            return
        }

        proc.terminate() // SIGTERM

        // SIGKILL after 5s if still running
        DispatchQueue.global().asyncAfter(deadline: .now() + 5) { [weak self] in
            if proc.isRunning {
                kill(proc.processIdentifier, SIGKILL)
            }
            DispatchQueue.main.async {
                self?.process = nil
                self?.isRunning = false
                self?.onStatusChange?(false)
            }
        }

        // If it exits quickly
        DispatchQueue.global().async {
            proc.waitUntilExit()
            DispatchQueue.main.async { [weak self] in
                self?.process = nil
                self?.isRunning = false
                self?.onStatusChange?(false)
            }
        }
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
    var config: AppConfig?

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

        let webUIItem = NSMenuItem(title: "Open Web UI", action: #selector(openWebUI), keyEquivalent: "w")
        webUIItem.target = self
        menu.addItem(webUIItem)

        let logsItem = NSMenuItem(title: "Open Logs", action: #selector(openLogs), keyEquivalent: "l")
        logsItem.target = self
        menu.addItem(logsItem)

        menu.addItem(NSMenuItem.separator())

        let configItem = NSMenuItem(title: "Edit Config", action: #selector(editConfig), keyEquivalent: ",")
        configItem.target = self
        menu.addItem(configItem)

        menu.addItem(NSMenuItem.separator())

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
    }

    @objc func toggleServer() {
        if serverManager.running {
            serverManager.stop()
        } else {
            serverManager.start()
        }
    }

    @objc func openWebUI() {
        let port = config?.gatewayPort ?? 4300
        // Web UI runs on port + 2 (4302 by default)
        let webPort = port + 2
        NSWorkspace.shared.open(URL(string: "http://localhost:\(webPort)")!)
    }

    @objc func openLogs() {
        let port = config?.gatewayPort ?? 4300
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

    @objc func quitApp() {
        serverManager.stop()
        // Give the server a moment to shut down
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
