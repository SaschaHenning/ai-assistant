# Web UI and Voice Interface Research

**Research Date:** February 14, 2026
**Purpose:** Evaluate web frameworks, chat UI options, voice interfaces, and real-time communication for a personal AI assistant.

---

## Executive Summary

**Recommended Stack:**
- **Web Framework:** React + Vite (SPA)
- **Chat UI:** Vercel AI SDK useChat hook + Custom Tailwind UI with Streamdown
- **Voice (Start Simple):** Web Speech API (browser-native, free)
- **Voice (Enhanced):** Deepgram (STT) + ElevenLabs Flash v2.5 (TTS)
- **Real-time:** Server-Sent Events (SSE) for streaming, with optional WebSocket upgrade

**Rationale:** This combination prioritizes simplicity, speed to build, excellent developer experience, and low bundle size while maintaining the flexibility to add advanced features later.

---

## 1. Web Framework Comparison

### 1.1 Next.js (App Router)

**Strengths:**
- Built-in API routes and server-side rendering
- Excellent ecosystem integration with Vercel AI SDK
- Streaming support with React Server Components
- Advanced patterns in 2026: Server Actions, Partial Prerendering (PPR), Edge-first architectures
- Route Handlers use Web Request/Response APIs for clean API endpoints

**Weaknesses:**
- Overkill for a simple chat UI that doesn't need SEO
- Larger bundle size (200-300KB initial + 42KB React runtime + ~70-90KB Next.js framework = 312-420KB total)
- More complexity than needed for internal tools

**Bundle Size:** 312-420KB initial bundle
**Best For:** Marketing sites, e-commerce, SaaS with public pages, SEO-critical apps

**Sources:**
- [Next.js App Router Streaming](https://nextjs.org/learn/dashboard-app/streaming)
- [Getting Started: Next.js App Router - AI SDK](https://ai-sdk.dev/docs/getting-started/nextjs-app-router)
- [Next.js Advanced Patterns for 2026](https://medium.com/@beenakumawat002/next-js-app-router-advanced-patterns-for-2026-server-actions-ppr-streaming-edge-first-b76b1b3dcac7)

---

### 1.2 SvelteKit

**Strengths:**
- Smallest bundle size by far (60-80% smaller than React apps)
- Only 1.6KB runtime vs React's 42KB
- Compile-time optimization eliminates virtual DOM overhead
- Typical bundle: 50-100KB vs Next.js 200-300KB
- Excellent DX with auto-imports and reactive state
- WebSocket integration available (sveltekit-ws, Socket.IO)
- Real-time streaming capabilities proven

**Weaknesses:**
- Smaller ecosystem than React (fewer libraries, fewer examples)
- Less mature AI SDK integration compared to React/Next.js
- Smaller talent pool and community

**Bundle Size:** 50-100KB initial (20-40KB framework + app code)
**Best For:** Performance-critical apps, mobile-first experiences, developers who prioritize bundle size

**Sources:**
- [SvelteKit vs Next.js Bundle Size Comparison](https://prismic.io/blog/sveltekit-vs-nextjs)
- [SvelteKit Real-time WebSocket App - Inngest](https://www.inngest.com/blog/building-a-realtime-websocket-app-using-sveltekit)
- [SvelteKit WebSocket Integration](https://github.com/ketarketir/sveltekit-ws)

---

### 1.3 React + Vite (SPA) ⭐ RECOMMENDED

**Strengths:**
- Fastest development experience in React ecosystem (sub-second HMR)
- No SSR overhead for a chat app that doesn't need it
- Full React ecosystem access (Vercel AI SDK, shadcn/ui, vast library support)
- 40-60% smaller bundles than Create React App
- Zero-config TypeScript support
- Automatic code splitting and tree-shaking with Rollup
- Perfect for dashboards, admin panels, internal tools

**Weaknesses:**
- No built-in API routes (use separate backend or serverless functions)
- No SSR/SSG (not needed for chat UI)
- Requires manual backend setup

**Bundle Size:** ~100-150KB (React 42KB + optimized app code)
**Best For:** Chat apps, dashboards, admin panels, internal tools where SEO isn't critical

**Sources:**
- [Vite vs Next.js Complete Comparison](https://designrevision.com/blog/vite-vs-nextjs)
- [Optimizing React Vite Bundle Size](https://shaxadd.medium.com/optimizing-your-react-vite-application-a-guide-to-reducing-bundle-size-6b7e93891c96)
- [Advanced Vite with React 2025](https://codeparrot.ai/blogs/advanced-guide-to-using-vite-with-react-in-2025)

---

### 1.4 Nuxt 3

**Strengths:**
- Vue ecosystem with excellent auto-imports
- Good DX and modern tooling
- AI SDK v5 now has full feature parity with React
- Nuxt UI provides purpose-built chat components
- Real-time streaming support with Socket.IO

**Weaknesses:**
- Smaller ecosystem than React
- Less community momentum than React/Next.js
- Fewer AI-specific examples and integrations

**Best For:** Teams already using Vue, projects needing full-stack Vue solution

**Sources:**
- [Build AI Chatbot with Nuxt UI](https://ui.nuxt.com/blog/how-to-build-an-ai-chat)
- [Nuxt UI Chat Template](https://github.com/nuxt-ui-templates/chat)
- [AI SDK Getting Started: Nuxt](https://ai-sdk.dev/docs/getting-started/nuxt)

---

## 2. Chat UI Options

### 2.1 @chatscope/chat-ui-kit-react

**Overview:** Open-source UI toolkit for web chat applications with pre-built components.

**Strengths:**
- Ready-made components (MessageList, Message, MessageInput, ConversationList, etc.)
- Customizable styling
- Well-documented with Storybook examples

**Weaknesses:**
- Limited information on streaming support
- No explicit markdown or code block rendering mentioned
- May require additional libraries for AI-specific features
- Last major activity unclear from search results

**Verdict:** Good for traditional chat apps, but lacks AI-specific optimizations.

**Sources:**
- [chatscope/chat-ui-kit-react GitHub](https://github.com/chatscope/chat-ui-kit-react)
- [chatscope Documentation](https://chatscope.io/docs/)

---

### 2.2 shadcn/ui Chat Components ⭐ RECOMMENDED

**Overview:** Official shadcn/ui now includes 25+ purpose-built React components for conversational AI interfaces.

**Strengths:**
- Production-ready ChatGPT-style UI components
- Built specifically for AI streaming responses
- Streaming responses buffer, parse, and render smoothly without flickering
- Tool call visualization (shows running functions, inputs, outputs)
- Markdown rendering with code highlighting
- TypeScript + Vercel AI SDK integration
- Copy-paste philosophy (you own the code)
- Multiple community implementations available:
  - **shadcn-chatbot-kit:** Fully functional chat with streaming, avatars, message actions
  - **shadcn-chat CLI:** Customizable chat components for Next.js/React

**Weaknesses:**
- Requires some assembly (not a monolithic library)
- Need to customize for your specific use case

**Verdict:** Best choice for AI chat interfaces with full control and modern patterns.

**Sources:**
- [shadcn/ui AI Components](https://www.shadcn.io/ai)
- [shadcn/ui AI Chatbot](https://www.shadcn.io/ai/chatbot)
- [shadcn-chatbot-kit](https://github.com/Blazity/shadcn-chatbot-kit)
- [shadcn-chat CLI](https://github.com/jakobhoeg/shadcn-chat)

---

### 2.3 Custom Chat UI with Tailwind + Streamdown ⭐ RECOMMENDED

**Overview:** Build custom UI with Tailwind CSS and use Streamdown for markdown streaming.

**Strengths:**
- **Streamdown:** Drop-in replacement for react-markdown designed for AI streaming
  - Handles incomplete/unterminated markdown blocks seamlessly
  - Built-in Tailwind classes for headings, lists, code blocks
  - Advanced memoization for streaming performance
  - GitHub Flavored Markdown support
  - Shiki syntax highlighting with copy buttons
  - LaTeX math via KaTeX
  - Mermaid diagrams
- **Prompt-kit:** Drop-in chat components with shadcn/ui + Tailwind
  - Message list, avatars, prompt input
  - Markdown rendering, streaming UI
  - Sources display
- **LlamaIndex Chat UI:** Ready-to-use React components for LLM chat interfaces

**Weaknesses:**
- More initial setup than pre-built libraries
- Need to handle layout and responsive design yourself

**Verdict:** Maximum flexibility and control, perfect for unique UX requirements.

**Sources:**
- [Streamdown - AI Markdown Streaming](https://github.com/vercel/streamdown)
- [Streamdown Official Site](https://streamdown.ai/)
- [Prompt-kit Chat UI](https://www.prompt-kit.com/chat-ui)
- [LlamaIndex Chat UI](https://github.com/run-llama/chat-ui)

---

### 2.4 Vercel AI SDK useChat Hook ⭐ RECOMMENDED

**Overview:** React hook that abstracts the complexity of a chat interface into one hook.

**Strengths:**
- Automatic streaming from `/api/chat` endpoint
- Manages chat state automatically
- UI updates in real-time as messages arrive
- Status tracking: "ready", "submitted", "streaming", "error"
- Transport-based architecture (AI SDK 5)
- Custom message types and data parts
- Fully typed tool invocations
- Type-safe message metadata
- Now available for Vue, Svelte, Angular with full feature parity

**Implementation:**
```typescript
import { useChat } from 'ai/react'

const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat()
```

**Weaknesses:**
- Opinionated structure (but flexible)
- Requires backend endpoint setup

**Verdict:** Essential building block for any AI chat interface.

**Sources:**
- [AI SDK UI: useChat](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [Vercel AI SDK Chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)
- [AI SDK 5 Announcement](https://vercel.com/blog/ai-sdk-5)
- [Real-time AI in Next.js with Vercel AI SDK](https://blog.logrocket.com/nextjs-vercel-ai-sdk-streaming/)

---

## 3. Voice Interface Options

### 3.1 Web Speech API (Browser-Native) ⭐ START HERE

**Overview:** Built into modern browsers, provides free speech recognition and synthesis.

**Strengths:**
- **Free** and no API costs
- No internet connection needed for speech synthesis
- Low latency for synthesis
- Simple JavaScript API
- **Speech Recognition (STT):** `SpeechRecognition` interface for voice input
- **Speech Synthesis (TTS):** `SpeechSynthesis` interface with built-in voices

**Weaknesses:**
- **Browser Support Limitations:**
  - Recognition: Only Chrome/Chromium browsers support it
  - Firefox doesn't officially support `SpeechRecognition`
  - Safari Mobile requires workarounds and has event handling issues
- Lower quality than commercial APIs
- Limited voice customization
- Recognition accuracy inferior to Whisper/Deepgram

**Pricing:** FREE
**Latency:** Very low for TTS (local processing)

**Verdict:** Perfect starting point for MVP. Add it first, upgrade later if needed.

**Sources:**
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Using Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)
- [Speech Recognition in Browser - AssemblyAI](https://www.assemblyai.com/blog/speech-recognition-javascript-web-speech-api)
- [Browser Support - Can I Use](https://caniuse.com/speech-recognition)

---

### 3.2 OpenAI Whisper API (STT)

**Overview:** OpenAI's speech-to-text model, industry-leading accuracy.

**Strengths:**
- Excellent transcription accuracy
- Multi-language support
- Simple REST API
- Well-documented

**Weaknesses:**
- **Not real-time:** Batch processing only (upload full audio file)
- ~500ms latency with custom chunking implementations
- No dedicated WebSocket endpoint for streaming
- Must implement custom chunking for pseudo-streaming

**Pricing:**
- Whisper: $0.006/minute ($0.36/hour)
- GPT-4o Mini Transcribe: $0.003/minute ($0.18/hour)
- GPT-4o Realtime API: WebSocket-based, pricing varies

**Latency:** ~500ms with chunking workarounds

**Verdict:** Good for batch transcription, not ideal for real-time voice chat.

**Sources:**
- [OpenAI Whisper API Pricing](https://costgoat.com/pricing/openai-transcription)
- [Whisper API Pricing 2026](https://brasstranscripts.com/blog/openai-whisper-api-pricing-2025-self-hosted-vs-managed)
- [Realtime API Discussion](https://community.openai.com/t/realtime-streaming-transcription/1371205)

---

### 3.3 Deepgram (Real-time STT) ⭐ RECOMMENDED FOR PRODUCTION

**Overview:** Fastest real-time streaming speech-to-text API with advanced conversational features.

**Strengths:**
- **Ultra-low latency:** Under 300ms (median)
  - 2.3x faster than AWS (700ms)
- **Streaming-native:** WebSocket support for continuous transcription
- High accuracy: 5.26% WER for general English
- Up to 500 concurrent streams by default
- **Flux model:** Purpose-built for conversation
  - Built-in turn detection
  - Natural interruption handling
  - Ideal for voice agents
- Scales easily without forced redundancy

**Weaknesses:**
- Paid service (though cheapest option)
- Requires internet connection

**Pricing:**
- Pay-as-you-go: $0.0077/minute ($0.46/hour)
- Growth Plan: $0.0065/minute ($0.39/hour) - 16% savings
- **Cheapest option:** $4.30 per 1000 minutes (Nova-3)

**Latency:** <300ms median

**Verdict:** Best real-time STT for production voice assistants.

**Sources:**
- [Deepgram Pricing 2026](https://brasstranscripts.com/blog/deepgram-pricing-per-minute-2025-real-time-vs-batch)
- [Deepgram STT API](https://deepgram.com/product/speech-to-text)
- [Deepgram vs OpenAI vs Google Comparison](https://deepgram.com/learn/deepgram-vs-openai-vs-google-stt-accuracy-latency-price-compared)
- [Best STT APIs 2026](https://deepgram.com/learn/best-speech-to-text-apis-2026)

---

### 3.4 ElevenLabs (TTS) ⭐ RECOMMENDED FOR PRODUCTION

**Overview:** High-quality text-to-speech API with multiple models and streaming support.

**Strengths:**
- **Multiple models with quality-speed tradeoffs:**
  - **Flash v2.5:** Ultra-low latency ~75ms for voice agents
  - **Turbo v2.5:** Balanced quality/speed ~250-300ms for interactive use
  - **Multilingual v2:** Consistent quality, up to 10,000 characters
  - **Eleven v3:** Maximum expressiveness for creative applications
- Streaming output support
- Typical response time: <500ms for streaming
- Excellent voice quality and customization
- Emotional range and natural prosody

**Weaknesses:**
- Paid service
- More expensive than alternatives

**Pricing (per 1,000 characters):**
- Creator: $0.30
- Pro: $0.24
- Scale: $0.18
- Business: $0.12

**Monthly Plans:**
- Creator: 100,000 chars included
- Pro ($99/mo): 500,000 credits = 1M characters

**Latency:** 75-500ms depending on model

**Verdict:** Best TTS quality for production. Use Flash v2.5 for real-time voice agents.

**Sources:**
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
- [ElevenLabs TTS Documentation](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)
- [ElevenLabs Complete Pricing Guide](https://flexprice.io/blog/elevenlabs-pricing-breakdown)

---

### 3.5 Voice Integration Strategy

**Phase 1: MVP (Start Simple)**
```
User speaks → Web Speech API (STT) → AI Assistant → Web Speech API (TTS) → User hears
```
- FREE, low latency, works in Chrome
- No backend changes needed
- Perfect for testing UX

**Phase 2: Enhanced Quality**
```
User speaks → Deepgram WebSocket (STT) → AI Assistant → ElevenLabs Flash (TTS) → User hears
```
- <300ms STT latency + ~75ms TTS latency = ~375ms total
- Production-quality accuracy and voice
- Scales to hundreds of concurrent users

**Implementation Notes:**
- Start with Web Speech API to validate voice UX
- Add toggle for users to opt into enhanced voice (Deepgram + ElevenLabs)
- Consider costs: ~$0.50/hour for enhanced voice (Deepgram $0.46/hr + ElevenLabs ~$0.04/hr)
- Use Web Speech API as fallback for unsupported browsers

---

## 4. Real-time Communication

### 4.1 WebSocket

**Overview:** Full-duplex communication over single TCP connection.

**Strengths:**
- **Bidirectional:** Both client and server can send messages anytime
- Persistent connection reduces latency and overhead
- Minimal headers after initial handshake
- Industry standard for chat applications
- Excellent library support (socket.io, ws, etc.)
- Perfect for traditional chat where both sides send/receive

**Weaknesses:**
- Slightly more complex than SSE for one-way streaming
- Requires WebSocket server setup
- Connection management overhead

**Best For:** Traditional chat with user messages and AI responses, collaborative editing, multiplayer games

**Sources:**
- [WebSockets vs SSE vs WebRTC](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html)
- [WebSockets vs SSE - Ably](https://ably.com/blog/websockets-vs-sse)
- [WebSockets vs SSE Key Differences](https://websimplified.in/websockets-vs-server-sent-events-sse-vs-webrtc)

---

### 4.2 Server-Sent Events (SSE) ⭐ RECOMMENDED FOR AI STREAMING

**Overview:** One-way communication from server to client using standard HTTP.

**Strengths:**
- **Simplest to implement:** Uses standard HTTP/S protocols
- **Perfect for AI streaming:** Server sends tokens, client receives
- Built-in reconnection logic
- Easier integration with Node.js and serverless
- Less overhead than WebSocket for one-way streaming
- Works with standard HTTP infrastructure (proxies, CDNs)
- **Vercel AI SDK default:** Uses SSE for `streamText` responses

**Weaknesses:**
- One-way only (client cannot send data over same connection)
- Client must use separate requests for sending messages

**Best For:** AI response streaming, live updates, notifications, feeds

**Typical Flow:**
1. User sends message via POST request
2. Server responds with SSE stream
3. Client receives tokens in real-time
4. User sends next message via new POST request

**Sources:**
- [WebSocket vs SSE - Svix](https://www.svix.com/resources/faq/websocket-vs-sse/)
- [SSE for AI Streaming](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html)

---

### 4.3 WebRTC

**Overview:** Peer-to-peer audio, video, and data sharing directly between browsers.

**Strengths:**
- Direct P2P connection (no server middleman)
- Best for audio/video calls
- Low latency for media streams
- No server bandwidth costs after connection established

**Weaknesses:**
- Complex signaling setup required
- Overkill for text chat
- NAT traversal challenges
- Not suitable for AI assistant chat (needs server for AI processing)

**Best For:** Video calls, screen sharing, P2P file transfer

**Verdict:** Not recommended for AI assistant chat.

**Sources:**
- [WebRTC vs WebSocket - Metered](https://www.metered.ca/blog/webrtc-vs-websocket/)
- [HTTP, WebSocket, gRPC, or WebRTC Comparison](https://getstream.io/blog/communication-protocols/)

---

### 4.4 Recommended Approach: SSE + Optional WebSocket

**For AI Chat Assistant:**

**Start with SSE:**
```
Client POST /api/chat → Server streams response via SSE → Client renders tokens
```
- Vercel AI SDK uses this by default
- Simplest implementation
- Perfect for AI streaming

**Upgrade to WebSocket (Optional):**
- Add WebSocket for bidirectional features:
  - Typing indicators
  - Presence (online/offline)
  - Multi-device sync
  - Real-time collaboration
- Keep SSE as fallback

**Hybrid Architecture:**
```typescript
// Use SSE for AI streaming (Vercel AI SDK handles this)
const { messages, isLoading } = useChat()

// Add WebSocket for real-time features
const ws = new WebSocket('/ws')
ws.on('typing', () => showTypingIndicator())
ws.on('presence', (users) => updateOnlineUsers(users))
```

---

## 5. Final Recommendations

### 5.1 Recommended Stack for Simple Personal AI Assistant

| Layer | Recommendation | Rationale |
|-------|---------------|-----------|
| **Framework** | React + Vite (SPA) | Fastest dev experience, smallest bundle in React ecosystem, full ecosystem access, perfect for internal tools |
| **Chat UI** | Vercel AI SDK `useChat` + shadcn/ui AI components + Streamdown | Production-ready streaming, full control, modern patterns, excellent markdown/code rendering |
| **Voice (MVP)** | Web Speech API | Free, low latency, validates UX without costs |
| **Voice (Production)** | Deepgram (STT) + ElevenLabs Flash v2.5 (TTS) | Best latency (<300ms + ~75ms), production quality, affordable ($0.50/hr) |
| **Real-time** | Server-Sent Events (SSE) | Simplest for AI streaming, Vercel AI SDK default, easy to implement |
| **Backend** | Node.js/Express or Serverless Functions | Lightweight API for chat endpoint, easy deployment |

### 5.2 Bundle Size Comparison

| Framework | Initial Bundle | Notes |
|-----------|---------------|-------|
| **React + Vite** | ~100-150KB | 42KB React + optimized app code |
| **SvelteKit** | 50-100KB | Smallest, 1.6KB runtime |
| **Next.js** | 312-420KB | 42KB React + 70-90KB Next.js + app code |
| **Nuxt 3** | ~150-200KB | Vue runtime + framework |

**Winner:** SvelteKit (smallest), but React + Vite offers best ecosystem/bundle size balance.

### 5.3 Implementation Roadmap

**Phase 1: Core Chat (Week 1)**
- Set up React + Vite
- Implement Vercel AI SDK `useChat` hook
- Build basic chat UI with shadcn/ui components
- Add markdown rendering with Streamdown
- Set up SSE streaming from backend

**Phase 2: Voice MVP (Week 2)**
- Add Web Speech API for STT/TTS
- Create voice toggle button
- Test UX with free browser voices
- Gather user feedback

**Phase 3: Enhanced Voice (Week 3-4)**
- Integrate Deepgram WebSocket for STT
- Add ElevenLabs Flash v2.5 for TTS
- Implement voice quality toggle (free vs. enhanced)
- Monitor costs and usage

**Phase 4: Polish (Ongoing)**
- Mobile responsiveness
- Dark mode theming
- Message history persistence
- Multi-device sync (optional WebSocket)

### 5.4 Cost Estimation (Enhanced Voice Mode)

**Assumptions:**
- 1 hour of voice conversation per day
- Enhanced mode enabled

**Monthly Costs:**
- Deepgram: 30 hours × $0.46/hour = $13.80
- ElevenLabs Pro: $99/month (includes 1M characters)
  - Estimated usage: ~200K chars/month at 1 hr/day
  - Well within Pro plan limits
- **Total:** ~$113/month for heavy usage

**Cost Optimization:**
- Use Web Speech API as default (FREE)
- Enhanced voice only on user opt-in
- Estimated cost for casual use: $5-20/month

---

## 6. Alternative Considerations

### 6.1 If You Need SEO or Server-Side Rendering
→ Use **Next.js App Router** instead of React + Vite
- Larger bundle but better for public-facing apps

### 6.2 If Bundle Size is Critical Priority
→ Use **SvelteKit**
- 60-80% smaller bundles than React
- Trade-off: Smaller ecosystem, less AI tooling

### 6.3 If You Want Fully Managed Backend
→ Use **Next.js** with API routes or **Nuxt 3**
- Built-in backend eliminates separate server setup

### 6.4 If You're Already Using Vue
→ Use **Nuxt 3** with Nuxt UI chat components
- AI SDK v5 now has full feature parity

---

## 7. Key Takeaways

1. **React + Vite is the sweet spot** for a chat-first personal AI assistant:
   - Fast development, small bundles, full ecosystem
   - Vercel AI SDK has best React support
   - Easy to deploy and maintain

2. **Start with Web Speech API for voice:**
   - FREE and validates UX immediately
   - Upgrade to Deepgram + ElevenLabs only if needed
   - ~$0.50/hour for production voice is very affordable

3. **SSE is perfect for AI streaming:**
   - Simpler than WebSocket for one-way streaming
   - Vercel AI SDK uses it by default
   - Add WebSocket later only if you need bidirectional features

4. **shadcn/ui + Streamdown = best chat UI:**
   - Production-ready components built for AI
   - Smooth streaming without flickering
   - Beautiful markdown and code rendering

5. **Mobile responsiveness matters:**
   - All frameworks handle mobile well
   - Focus on responsive Tailwind layouts
   - Test voice on mobile early (browser support varies)

---

## Sources

### Web Frameworks
- [Next.js App Router Streaming](https://nextjs.org/learn/dashboard-app/streaming)
- [Getting Started: Next.js App Router - AI SDK](https://ai-sdk.dev/docs/getting-started/nextjs-app-router)
- [Next.js Advanced Patterns for 2026](https://medium.com/@beenakumawat002/next-js-app-router-advanced-patterns-for-2026-server-actions-ppr-streaming-edge-first-b76b1b3dcac7)
- [SvelteKit vs Next.js Comparison](https://prismic.io/blog/sveltekit-vs-nextjs)
- [SvelteKit Real-time WebSocket App](https://www.inngest.com/blog/building-a-realtime-websocket-app-using-sveltekit)
- [Vite vs Next.js Complete Comparison](https://designrevision.com/blog/vite-vs-nextjs)
- [Advanced Vite with React 2025](https://codeparrot.ai/blogs/advanced-guide-to-using-vite-with-react-in-2025)
- [Build AI Chatbot with Nuxt UI](https://ui.nuxt.com/blog/how-to-build-an-ai-chat)

### Chat UI
- [shadcn/ui AI Components](https://www.shadcn.io/ai)
- [shadcn-chatbot-kit](https://github.com/Blazity/shadcn-chatbot-kit)
- [shadcn-chat CLI](https://github.com/jakobhoeg/shadcn-chat)
- [Streamdown - AI Markdown Streaming](https://github.com/vercel/streamdown)
- [Prompt-kit Chat UI](https://www.prompt-kit.com/chat-ui)
- [AI SDK UI: useChat](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [AI SDK 5 Announcement](https://vercel.com/blog/ai-sdk-5)

### Voice Interfaces
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Using Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)
- [OpenAI Whisper API Pricing](https://costgoat.com/pricing/openai-transcription)
- [Deepgram Pricing 2026](https://brasstranscripts.com/blog/deepgram-pricing-per-minute-2025-real-time-vs-batch)
- [Deepgram vs OpenAI vs Google](https://deepgram.com/learn/deepgram-vs-openai-vs-google-stt-accuracy-latency-price-compared)
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
- [ElevenLabs Complete Pricing Guide](https://flexprice.io/blog/elevenlabs-pricing-breakdown)

### Real-time Communication
- [WebSockets vs SSE vs WebRTC](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html)
- [WebSockets vs SSE - Ably](https://ably.com/blog/websockets-vs-sse)
- [WebSocket vs SSE - Svix](https://www.svix.com/resources/faq/websocket-vs-sse/)
- [WebRTC vs WebSocket - Metered](https://www.metered.ca/blog/webrtc-vs-websocket/)

---

**End of Research Report**
