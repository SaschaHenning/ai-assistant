# AI/LLM Integration Research

**Research Date:** February 14, 2026
**Objective:** Compare approaches for integrating AI/LLM capabilities into a personal AI assistant

---

## Executive Summary

For a **simple personal AI assistant** that needs Claude (primary) and OpenAI (fallback) support with tool calling and streaming, the **recommended approach is Vercel AI SDK**.

**Why Vercel AI SDK wins:**
- Clean, unified API for multiple providers (20+ supported)
- Native streaming support with SSE
- Excellent tool calling (now with streaming tool inputs)
- Moderate bundle size (67.5 kB gzipped) - reasonable for the feature set
- Active development and strong community
- Built for TypeScript/modern JS runtimes
- Good balance of simplicity and capability

**Runner-up for specific use cases:**
- **Direct SDK integration** if bundle size is critical and you only need basic features
- **Mastra** if you need advanced agent workflows with memory out-of-the-box

---

## Detailed Comparison

### 1. Direct SDK Integration (Anthropic + OpenAI)

**Overview:**
Using `@anthropic-ai/sdk` and `openai` packages directly without abstraction layers.

**Bundle Size:**
- OpenAI SDK: **34.3 kB gzipped** (smallest option)
- Anthropic SDK: Similar lightweight footprint
- Combined: ~70 kB for both providers

**Multi-Model Support:**
- ❌ Manual implementation required
- You must write provider-switching logic yourself
- Different API patterns between providers

**Streaming Support:**
- ✅ Both SDKs support streaming
- Anthropic: `anthropic.messages.stream()` with event helpers
- OpenAI: `stream: true` with async iteration
- Manual SSE/WebSocket implementation needed for client

**Tool/Function Calling:**
- ✅ Both support tool calling
- Anthropic: `beta.messages.toolRunner()` with Zod schemas
- OpenAI: Native function calling in chat completions
- Requires separate implementation for each provider

**Memory & Context Management:**
- ❌ Manual implementation required
- You must handle conversation history
- Context window pruning logic is your responsibility
- No built-in summarization

**Cost Tracking:**
- ✅ Token usage reported in responses
- Both SDKs return usage metadata (`input_tokens`, `output_tokens`)
- Manual aggregation and cost calculation needed

**Maintenance:**
- ✅ Official SDKs, actively maintained
- 8.8M weekly downloads (OpenAI SDK)
- First-party support

**Pros:**
- Smallest bundle size
- Full control over implementation
- No abstraction overhead
- Direct access to latest provider features

**Cons:**
- More boilerplate code
- Manual multi-provider logic
- No unified patterns
- Memory/context management from scratch

**Best For:**
- Minimal bundle size requirements
- Simple use cases with single provider
- Maximum control needed

**Sources:**
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [LangChain vs Vercel AI SDK vs OpenAI SDK](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)

---

### 2. Vercel AI SDK

**Overview:**
Unified TypeScript interface for 20+ AI providers with streaming-first architecture.

**Bundle Size:**
- Core SDK: **67.5 kB gzipped**
- Individual providers (e.g., OpenAI): **19.5 kB gzipped**
- Total with 3-4 providers: Often less than OpenAI SDK alone
- Note: Core library can add ~186 kB when unoptimized

**Multi-Model Support:**
- ✅ **Excellent** - 20+ providers with unified API
- Switch providers by changing import: `openai('gpt-4')` vs `anthropic('claude-3-5-sonnet')`
- Consistent interface across all models
- Supports OpenAI, Anthropic, Google, Mistral, Cohere, and more

**Streaming Support:**
- ✅ **Best-in-class** streaming
- Server-Sent Events (SSE) standard
- Native browser support
- Tool call inputs now stream by default with partial updates
- React hooks for easy UI integration

**Tool/Function Calling:**
- ✅ **Excellent** tool calling support
- Unified tool interface across providers
- Streaming tool inputs
- Multi-step agentic reasoning
- Type-safe with Zod schemas

**Memory & Context Management:**
- ⚠️ **In Development** (as of January 2026)
- New Memory Module primitives added (MemoryAdapter, MemoryEntry)
- Currently stateless by default - manual context management needed
- Message compression/filtering utilities available
- Integration with Mem0 for persistent memory
- Community patterns for conversation compaction (150+ messages)

**Cost Tracking:**
- ✅ Token usage tracking built-in
- `onFinish` callback for recording usage after streaming
- Usage metadata available in responses
- Integration with Langfuse for advanced monitoring

**Maintenance:**
- ✅ Very active development
- Latest: AI SDK 6 (recent release)
- Strong community and ecosystem
- Edge runtime support

**Pros:**
- Unified API across 20+ providers
- Excellent streaming with SSE
- Type-safe tool calling
- Moderate bundle size (with optimization)
- Active development
- Good documentation
- React/Next.js integration

**Cons:**
- Memory management still maturing
- Bundle size can grow if not optimized
- Zod dependency adds weight
- Some abstraction overhead

**Best For:**
- **Multi-provider support** (Claude + OpenAI + fallbacks)
- Streaming-first applications
- Modern TypeScript projects
- Balanced simplicity and capability

**Sources:**
- [AI SDK by Vercel](https://ai-sdk.dev/docs/introduction)
- [AI SDK 6 Release](https://vercel.com/blog/ai-sdk-6)
- [Vercel AI SDK Overview](https://voltagent.dev/blog/vercel-ai-sdk/)
- [Bundle Size Analysis](https://blog.hyperknot.com/p/til-vercel-ai-sdk-the-bloat-king)
- [Memory Module PR](https://github.com/vercel/ai/pull/11861)

---

### 3. LangChain.js / LangGraph

**Overview:**
Comprehensive framework for complex agent workflows, chains, and RAG implementations.

**Bundle Size:**
- LangChain.js: **101.2 kB gzipped** (largest option)
- With optimization: 37.32 kB for RAG use case
- Heavy dependency tree
- ❌ Blocks edge runtime deployment

**Multi-Model Support:**
- ✅ Mature ecosystem with broad provider support
- Abstracted through LangChain's interface
- Most comprehensive library for model integrations

**Streaming Support:**
- ✅ Supported but not streaming-first
- More focus on chain execution than streaming UX

**Tool/Function Calling:**
- ✅ Comprehensive agent framework
- Chains, memory modules, tool integrations
- LangGraph for cyclic/branching logic

**Memory & Context Management:**
- ✅ **Best-in-class** for complex scenarios
- Multiple memory types (buffer, summary, entity, etc.)
- ConversationChain with built-in memory
- LangGraph for stateful workflows

**Cost Tracking:**
- ✅ Through LangSmith integration
- Comprehensive tracing and monitoring
- Requires additional service

**Maintenance:**
- ✅ Very active, mature project
- TypeScript catching up to Python version
- Large community

**Pros:**
- Most comprehensive framework
- Best memory/state management
- Mature RAG support
- Complex agent workflows
- LangGraph for advanced patterns

**Cons:**
- **Overkill for simple assistants**
- Largest bundle size (101.2 kB)
- Blocks edge deployment
- Steeper learning curve
- Performance overhead from abstraction layers
- Can be slow for real-time use cases

**Best For:**
- Complex agent workflows
- RAG applications with knowledge bases
- Multi-step reasoning chains
- When you need battle-tested patterns

**Not Recommended For:**
- Simple personal assistants (too heavy)
- Edge deployments
- Low-latency requirements

**Sources:**
- [LangGraph Overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [LangChain vs LangGraph Guide](https://chetoai.com/langchain-vs-langgraph-choosing-right-ai-in-2026/)
- [Bundle Size Analysis](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)

---

### 4. Mastra

**Overview:**
New TypeScript AI framework (launched January 2025) from Gatsby team, focused on modern developer experience.

**Bundle Size:**
- Recently optimized: **8 MB → minimal** (with aggressive tree-shaking)
- Pre-bundled dependencies for smaller footprint
- Modular architecture (@mastra/core, @mastra/fastembed separate)
- Tree-shaking removes unused exports
- Excellent edge deployment support

**Multi-Model Support:**
- ✅ **Excellent** - 40+ providers through unified interface
- OpenAI, Anthropic, Google Gemini, and more
- Model routing capabilities

**Streaming Support:**
- ✅ Streaming supported
- Modern JavaScript runtime support (Node.js, Deno, Bun, Cloudflare Workers)

**Tool/Function Calling:**
- ✅ Built-in agent primitives
- Function calling support
- Integrated playground (Mastra Studio) for testing

**Memory & Context Management:**
- ✅ **Excellent** - standout feature
- **Observational Memory**: automatic compression of old messages
- Short-term and long-term memory systems
- Context window split: observations (compressed) + recent history
- Memory processors for filtering/trimming
- Configurable (default: last 10 messages)
- Prevents context window overflow

**Cost Tracking:**
- ⚠️ Not explicitly documented
- Likely requires manual implementation

**Maintenance:**
- ✅ Very active (150K weekly downloads in first year)
- Third-fastest growing JS framework ever
- $13M seed funding
- Strong momentum

**Pros:**
- **Best memory system** (observational memory)
- Lightweight after optimizations
- Modern developer experience
- Mastra Studio for visual debugging
- 40+ model providers
- RAG capabilities built-in
- Edge-friendly

**Cons:**
- Still relatively new (1 year old)
- Smaller community than LangChain/Vercel
- Less battle-tested
- Documentation still growing

**Best For:**
- Agent workflows with advanced memory needs
- Long-running conversations
- Modern TypeScript stacks
- Edge deployments

**Sources:**
- [Mastra GitHub](https://github.com/mastra-ai/mastra)
- [Mastra Documentation](https://mastra.ai/docs)
- [Mastra Launch Article](https://thenewstack.io/mastra-empowers-web-devs-to-build-ai-agents-in-typescript/)
- [Bundle Size Optimization](https://mastra.ai/blog/seamless-edge-deployments)
- [Memory Overview](https://mastra.ai/docs/memory/overview)
- [Observational Memory](https://mastra.ai/docs/memory/observational-memory)

---

### 5. LlamaIndex.ts

**Overview:**
TypeScript framework focused on RAG (Retrieval-Augmented Generation) and data integration.

**Bundle Size:**
- Not extensively documented
- Built for server-side, not optimized for edge

**Multi-Model Support:**
- ✅ Supports multiple providers
- Focus on RAG workflows

**Streaming Support:**
- ✅ Supported
- Modern runtime support (Node.js, Deno, Bun, Cloudflare Workers)

**Tool/Function Calling:**
- ⚠️ Limited - not the primary focus
- Agent support exists but RAG-centric

**Memory & Context Management:**
- ✅ Strong for RAG use cases
- Vector database integration
- Knowledge base management
- Less focus on conversational memory

**Cost Tracking:**
- ⚠️ Not a primary feature

**Maintenance:**
- ✅ Active project
- Part of larger LlamaIndex ecosystem

**Pros:**
- **Best for RAG applications**
- Data connectors (APIs, files, SQL)
- Vector database support
- Query engines for knowledge bases

**Cons:**
- **Overkill if you don't need RAG**
- Less suitable for simple chat
- Heavier focus on indexing than conversation

**Best For:**
- RAG applications with knowledge bases
- Document Q&A systems
- Data-heavy AI applications

**Not Recommended For:**
- Simple conversational assistants
- Applications without RAG needs

**Sources:**
- [LlamaIndex.TS Documentation](https://developers.llamaindex.ai/typescript/framework/)
- [RAG Tutorial](https://ts.llamaindex.ai/docs/llamaindex/tutorials/rag)
- [LlamaIndex GitHub](https://github.com/run-llama/LlamaIndexTS)

---

## Comparison Matrix

| Feature | Direct SDKs | Vercel AI SDK | LangChain.js | Mastra | LlamaIndex.ts |
|---------|-------------|---------------|--------------|---------|---------------|
| **Bundle Size** | ✅ 34-70 kB | ⚠️ 67.5 kB | ❌ 101.2 kB | ✅ Optimized | ⚠️ Medium |
| **Multi-Model** | ❌ Manual | ✅ 20+ models | ✅ Broad | ✅ 40+ models | ✅ Good |
| **Streaming** | ⚠️ Manual | ✅ Excellent | ⚠️ Good | ✅ Good | ✅ Good |
| **Tool Calling** | ⚠️ Per SDK | ✅ Unified | ✅ Advanced | ✅ Built-in | ⚠️ Limited |
| **Memory/Context** | ❌ Manual | ⚠️ Maturing | ✅ Excellent | ✅ **Best** | ⚠️ RAG-focused |
| **Cost Tracking** | ⚠️ Manual | ✅ Built-in | ✅ LangSmith | ⚠️ Manual | ⚠️ Limited |
| **Edge Runtime** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | ⚠️ Limited |
| **Maintenance** | ✅ Official | ✅ Very Active | ✅ Mature | ✅ Growing | ✅ Active |
| **Learning Curve** | Low | Low-Medium | High | Medium | Medium-High |
| **Dependencies** | Minimal | Moderate | Heavy | Moderate | Moderate |
| **Best For** | Simple/Minimal | **General Use** | Complex Agents | Advanced Memory | RAG Apps |

---

## Recommendation for Simple Personal AI Assistant

### Primary Choice: **Vercel AI SDK** ⭐

**Reasoning:**
1. **Right level of abstraction** - Not too heavy (LangChain), not too manual (Direct SDKs)
2. **Multi-provider out of the box** - Claude + OpenAI + fallbacks with one API
3. **Streaming-first** - Perfect for chat interfaces with SSE
4. **Active development** - AI SDK 6 just released with continuous improvements
5. **Type-safe** - Excellent TypeScript support
6. **Reasonable bundle size** - 67.5 kB is acceptable for the feature set
7. **Tool calling** - Unified interface across providers with streaming inputs

**Trade-offs:**
- Memory management is still maturing (manual implementation needed for now)
- Slightly larger than direct SDKs, but worth it for multi-provider support

### Alternative: **Mastra** (If memory is critical)

**When to choose:**
- You need advanced conversation memory out-of-the-box
- Long-running conversations are common
- Observational memory would save implementation time
- You're okay with a newer framework

**Trade-offs:**
- Smaller community
- Less battle-tested than Vercel AI SDK
- May be more than needed for "simple" assistant

### Not Recommended:

**LangChain.js/LangGraph:**
- Too heavy for simple assistant (101.2 kB)
- Blocks edge deployment
- Overkill unless you need complex chains/RAG

**LlamaIndex.ts:**
- Only if you need RAG with knowledge bases
- Not ideal for simple conversational assistant

**Direct SDKs:**
- Only if bundle size is absolutely critical (<40 kB requirement)
- Requires significant boilerplate for multi-provider support

---

## Implementation Blueprint (Vercel AI SDK)

```typescript
// Example setup with Claude (primary) and OpenAI (fallback)
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';

// Provider selection with fallback
async function chat(userMessage: string, provider: 'claude' | 'openai' = 'claude') {
  const model = provider === 'claude'
    ? anthropic('claude-3-5-sonnet-20241022')
    : openai('gpt-4-turbo');

  const result = await streamText({
    model,
    messages: [
      { role: 'user', content: userMessage }
    ],
    tools: {
      weather: tool({
        description: 'Get weather for a location',
        parameters: z.object({
          location: z.string(),
        }),
        execute: async ({ location }) => {
          // Tool implementation
          return { temperature: 72, condition: 'sunny' };
        },
      }),
    },
    onFinish: ({ usage, finishReason }) => {
      // Track costs
      console.log('Tokens used:', usage);
    },
  });

  return result.toDataStreamResponse();
}
```

**What you still need to implement:**
- Conversation history management (store messages in DB)
- Context window pruning (summarize old messages when approaching limit)
- Cost aggregation (sum token usage per user/session)
- Error handling and fallback logic

---

## Cost Tracking Recommendations

For all approaches, you'll want external monitoring:

**Options:**
1. **Langfuse** - Free tier, excellent tracking, integrates with most SDKs
2. **LangSmith** - From LangChain team, comprehensive but LangChain-focused
3. **Custom solution** - Aggregate usage from SDK responses, store in DB

**Vercel AI SDK approach:**
```typescript
const result = await streamText({
  model,
  onFinish: async ({ usage }) => {
    await db.usage.create({
      userId,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      cost: calculateCost(usage, provider),
    });
  },
});
```

---

## Context Window Management Pattern

Since memory is still manual in most solutions (except Mastra), here's a recommended pattern:

```typescript
// Sliding window with summarization
async function manageContext(messages: Message[], maxMessages = 20) {
  if (messages.length <= maxMessages) {
    return messages;
  }

  // Keep system prompt + recent messages
  const systemMessages = messages.filter(m => m.role === 'system');
  const recentMessages = messages.slice(-maxMessages);

  // Summarize older messages
  const oldMessages = messages.slice(0, -maxMessages);
  const summary = await summarizeMessages(oldMessages);

  return [
    ...systemMessages,
    { role: 'system', content: `Previous conversation summary: ${summary}` },
    ...recentMessages,
  ];
}
```

---

## Conclusion

**For your simple personal AI assistant:**

✅ **Choose Vercel AI SDK**

It offers the best balance of:
- Multi-provider support (Claude + OpenAI)
- Developer experience
- Streaming capabilities
- Tool calling
- Active maintenance
- Reasonable bundle size

You'll need to implement conversation memory and context management yourself, but the patterns are well-documented in the community.

**Only deviate if:**
- Bundle size must be <40 kB → Direct SDKs
- Advanced memory is critical → Mastra
- Complex RAG needed → LlamaIndex.ts (but likely overkill)

---

## Sources

### Vercel AI SDK
- [AI SDK by Vercel](https://ai-sdk.dev/docs/introduction)
- [AI SDK 6 Release](https://vercel.com/blog/ai-sdk-6)
- [What is Vercel AI SDK?](https://voltagent.dev/blog/vercel-ai-sdk/)
- [Bundle Size Analysis](https://blog.hyperknot.com/p/til-vercel-ai-sdk-the-bloat-king)
- [Memory Module Development](https://github.com/vercel/ai/pull/11861)
- [Vercel AI SDK with Mem0](https://docs.mem0.ai/integrations/vercel-ai-sdk)

### Anthropic SDK
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [TypeScript SDK Documentation](https://platform.claude.com/docs/en/api/sdks/typescript)
- [Streaming Messages](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [Agent SDK Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Building Agents with Claude SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)

### Mastra
- [Mastra GitHub](https://github.com/mastra-ai/mastra)
- [Mastra Documentation](https://mastra.ai/docs)
- [The TypeScript AI Framework](https://mastra.ai/)
- [Mastra Launch Article](https://thenewstack.io/mastra-empowers-web-devs-to-build-ai-agents-in-typescript/)
- [Seamless Edge Deployments](https://mastra.ai/blog/seamless-edge-deployments)
- [Memory Overview](https://mastra.ai/docs/memory/overview)
- [Observational Memory](https://mastra.ai/docs/memory/observational-memory)

### LangChain.js / LangGraph
- [LangGraph Overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [LangChain vs LangGraph Guide](https://chetoai.com/langchain-vs-langgraph-choosing-right-ai-in-2026/)
- [Building AI Agents with JavaScript](https://medium.com/@vishwajeety14122/building-ai-agents-with-javascript-typescript-your-complete-guide-7cf969e7d85b)
- [Bundle Size Analysis](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)

### LlamaIndex.ts
- [LlamaIndex.TS Documentation](https://developers.llamaindex.ai/typescript/framework/)
- [RAG Tutorial](https://ts.llamaindex.ai/docs/llamaindex/tutorials/rag)
- [LlamaIndex GitHub](https://github.com/run-llama/LlamaIndexTS)

### General Comparisons
- [LangChain vs Vercel AI SDK vs OpenAI SDK](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)
- [OpenAI SDK vs Vercel AI SDK](https://strapi.io/blog/openai-sdk-vs-vercel-ai-sdk-comparison)
- [Cost Tracking - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/cost-tracking)
- [Token Usage Tracking](https://www.statsig.com/perspectives/tokenusagetrackingcontrollingaicosts)
