import { AIClient } from '../AIClient';
import { aiEventBus } from '../ops/AIEventBus';
import { logger }     from '../../utils/logger';
import * as crypto    from 'crypto';

/**
 * A typed directed-acyclic graph for chaining AI agents.
 *
 * Pattern: TestPlannerAgent → TestWriterAgent → TestValidatorAgent
 *
 * Each node receives the current shared state, enriches it, and passes it forward.
 * On error a node can attach `state.error` and the graph stops early.
 *
 * Example:
 *   const graph = new AgentGraph<PlanState>()
 *     .addNode('plan',     plannerAgent.run.bind(plannerAgent))
 *     .addNode('write',    writerAgent.run.bind(writerAgent))
 *     .addNode('validate', validatorAgent.run.bind(validatorAgent))
 *     .addEdge('plan', 'write')
 *     .addEdge('write', 'validate')
 *     .setStart('plan');
 *
 *   const result = await graph.run(initialState);
 */

export type AgentFn<S extends AgentState> = (state: S, ai: AIClient) => Promise<S>;

export interface AgentState {
  sessionId:  string;
  error?:     string;
  [key: string]: unknown;
}

export class AgentGraph<S extends AgentState> {
  private nodes: Map<string, AgentFn<S>> = new Map();
  private edges: Map<string, string>     = new Map();
  private startNode = '';

  addNode(name: string, fn: AgentFn<S>): this {
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(from: string, to: string): this {
    this.edges.set(from, to);
    return this;
  }

  setStart(name: string): this {
    this.startNode = name;
    return this;
  }

  async run(initialState: Omit<S, 'sessionId'>): Promise<S> {
    const sessionId = crypto.randomBytes(6).toString('hex');
    let state = { ...initialState, sessionId } as S;

    if (!this.startNode) throw new Error('[AgentGraph] No start node defined');

    let current: string | undefined = this.startNode;

    while (current) {
      const fn = this.nodes.get(current);
      if (!fn) throw new Error(`[AgentGraph] Unknown node: "${current}"`);

      logger.info(`[AgentGraph] → ${current} (session ${sessionId})`);

      try {
        state = await fn(state, AIClient.getInstance());
      } catch (err) {
        const msg = (err as Error).message;
        state = { ...state, error: msg };
        logger.error(`[AgentGraph] Node "${current}" failed: ${msg}`);
        // Emit error stage so dashboard session card resolves instead of staying at last stage
        const source = (state.inputType as string | undefined) ?? 'story';
        emitStage(state.sessionId, 'error', source as 'story' | 'nl' | 'recording', msg);
        break;
      }

      if (state.error) {
        logger.warn(`[AgentGraph] Stopping — node "${current}" set error: ${state.error}`);
        break;
      }

      current = this.edges.get(current);
    }

    return state;
  }

  /**
   * Report current graph structure for dashboard/debugging.
   */
  describe(): { nodes: string[]; edges: Record<string, string>; start: string } {
    return {
      nodes: [...this.nodes.keys()],
      edges: Object.fromEntries(this.edges),
      start: this.startNode,
    };
  }
}

/** Convenience: create a linear pipeline A → B → C without repeating addEdge calls. */
export function linearGraph<S extends AgentState>(
  ...nodes: Array<[name: string, fn: AgentFn<S>]>
): AgentGraph<S> {
  const graph = new AgentGraph<S>();
  nodes.forEach(([name, fn]) => graph.addNode(name, fn));
  for (let i = 0; i < nodes.length - 1; i++) {
    graph.addEdge(nodes[i][0], nodes[i + 1][0]);
  }
  if (nodes.length > 0) graph.setStart(nodes[0][0]);
  return graph;
}

/** Helper to emit testgen events through the graph for dashboard visibility. */
export function emitStage(
  sessionId: string,
  stage: 'planning' | 'writing' | 'validating' | 'complete' | 'error',
  source: 'story' | 'nl' | 'recording',
  output?: string,
  score?: number,
): void {
  aiEventBus.emitTestGen({ sessionId, source, stage, output, score, timestamp: Date.now() });
}
