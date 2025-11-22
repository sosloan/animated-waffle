/**
 * PROPERTY TEST: agent.prop.ts
 * Property-based tests for agent operations
 */

import { describe, it, expect } from 'vitest';
import {
  createAgent,
  cloneAgent,
  addFact,
  addTool,
  type MetaAgent,
} from './agent';

function forAll<T>(generator: () => T, property: (value: T) => boolean, iterations = 50): void {
  for (let i = 0; i < iterations; i++) {
    const value = generator();
    if (!property(value)) {
      throw new Error(`Property violated with value: ${JSON.stringify(value)}`);
    }
  }
}

function randomAgentKind(): MetaAgent['kind'] {
  const kinds: Array<MetaAgent['kind']> = [
    'student',
    'tutor',
    'curriculumDesigner',
    'pedagogyTheorist',
    'theoremProver',
    'metaDesigner',
  ];
  return kinds[Math.floor(Math.random() * kinds.length)];
}

describe('agent - properties', () => {
  describe('creation properties', () => {
    it('should always create valid agent structure', () => {
      forAll(
        () => ({ id: `a${Math.random()}`, kind: randomAgentKind() }),
        ({ id, kind }) => {
          const agent = createAgent(id, kind);
          return (
            agent.id === id &&
            agent.kind === kind &&
            agent.perception !== undefined &&
            agent.reasoning !== undefined &&
            agent.coordination !== undefined &&
            agent.objectives !== undefined
          );
        }
      );
    });

    it('should initialize objectives with 6 values', () => {
      forAll(
        () => createAgent(`a${Math.random()}`, randomAgentKind()),
        (agent) => agent.objectives.values.length === 6
      );
    });

    it('should start with empty knowledge for all kinds', () => {
      forAll(
        () => createAgent(`a${Math.random()}`, randomAgentKind()),
        (agent) => agent.reasoning.knowledge.length === 0
      );
    });

    it('should have valid timestamp', () => {
      forAll(
        () => createAgent(`a${Math.random()}`, randomAgentKind()),
        (agent) => {
          const now = Date.now();
          return (
            agent.perception.timestamp <= now &&
            agent.perception.timestamp > now - 1000
          );
        }
      );
    });
  });

  describe('cloning properties', () => {
    it('should preserve agent kind', () => {
      forAll(
        () => createAgent(`a${Math.random()}`, randomAgentKind()),
        (original) => {
          const clone = cloneAgent(original);
          return clone.kind === original.kind;
        }
      );
    });

    it('should preserve generation', () => {
      forAll(
        () => {
          const agent = createAgent(`a${Math.random()}`, randomAgentKind());
          agent.generation = Math.floor(Math.random() * 100);
          return agent;
        },
        (original) => {
          const clone = cloneAgent(original);
          return clone.generation === original.generation;
        }
      );
    });

    it('should preserve knowledge size', () => {
      forAll(
        () => {
          const agent = createAgent(`a${Math.random()}`, randomAgentKind());
          const numFacts = Math.floor(Math.random() * 10);
          for (let i = 0; i < numFacts; i++) {
            addFact(agent, `fact-${i}`);
          }
          return agent;
        },
        (original) => {
          const clone = cloneAgent(original);
          return clone.reasoning.knowledge.length === original.reasoning.knowledge.length;
        }
      );
    });

    it('should not mutate original', () => {
      forAll(
        () => createAgent(`a${Math.random()}`, randomAgentKind()),
        (original) => {
          const originalKnowledgeSize = original.reasoning.knowledge.length;
          const clone = cloneAgent(original);
          addFact(clone, 'new fact');
          return original.reasoning.knowledge.length === originalKnowledgeSize;
        }
      );
    });

    it('should extend lineage', () => {
      forAll(
        () => createAgent(`a${Math.random()}`, randomAgentKind()),
        (original) => {
          const originalLineageLength = original.lineage.length;
          const clone = cloneAgent(original);
          return clone.lineage.length > originalLineageLength;
        }
      );
    });
  });

  describe('knowledge accumulation properties', () => {
    it('should monotonically increase knowledge size', () => {
      forAll(
        () => createAgent(`a${Math.random()}`, randomAgentKind()),
        (agent) => {
          const sizes: number[] = [agent.reasoning.knowledge.length];
          for (let i = 0; i < 5; i++) {
            addFact(agent, `fact-${i}`);
            sizes.push(agent.reasoning.knowledge.length);
          }
          // Check monotonic increase
          for (let i = 1; i < sizes.length; i++) {
            if (sizes[i] <= sizes[i - 1]) return false;
          }
          return true;
        }
      );
    });

    it('should preserve fact order', () => {
      forAll(
        () => createAgent(`a${Math.random()}`, randomAgentKind()),
        (agent) => {
          const facts = ['fact1', 'fact2', 'fact3'];
          facts.forEach(f => addFact(agent, f));
          
          for (let i = 0; i < facts.length; i++) {
            if (agent.reasoning.knowledge[i].type !== 'fact') return false;
            if ((agent.reasoning.knowledge[i] as any).content !== facts[i]) return false;
          }
          return true;
        },
        20
      );
    });
  });

  describe('tool cost properties', () => {
    it('should accumulate tool costs', () => {
      forAll(
        () => createAgent(`a${Math.random()}`, randomAgentKind()),
        (agent) => {
          const costs: number[] = [];
          for (let i = 0; i < 5; i++) {
            const cost = Math.random();
            costs.push(cost);
            addTool(agent, { name: `tool-${i}`, cost });
          }
          
          const totalCost = agent.coordination.tools.reduce((sum, t) => sum + t.cost, 0);
          const expectedCost = costs.reduce((sum, c) => sum + c, 0);
          
          return Math.abs(totalCost - expectedCost) < 1e-10;
        },
        20
      );
    });

    it('should never have negative total cost', () => {
      forAll(
        () => {
          const agent = createAgent(`a${Math.random()}`, randomAgentKind());
          const numTools = Math.floor(Math.random() * 10);
          for (let i = 0; i < numTools; i++) {
            addTool(agent, { name: `tool-${i}`, cost: Math.random() });
          }
          return agent;
        },
        (agent) => {
          const totalCost = agent.coordination.tools.reduce((sum, t) => sum + t.cost, 0);
          return totalCost >= 0;
        }
      );
    });
  });

  describe('tri-layer invariants', () => {
    it('should always maintain all three layers', () => {
      forAll(
        () => {
          const agent = createAgent(`a${Math.random()}`, randomAgentKind());
          // Perform random operations
          if (Math.random() > 0.5) addFact(agent, 'test');
          if (Math.random() > 0.5) addTool(agent, { name: 'test', cost: 0.1 });
          return agent;
        },
        (agent) => {
          return (
            agent.perception !== undefined &&
            agent.reasoning !== undefined &&
            agent.coordination !== undefined
          );
        }
      );
    });

    it('should maintain objective vector dimension', () => {
      forAll(
        () => {
          const agent = createAgent(`a${Math.random()}`, randomAgentKind());
          // Simulate evolution steps
          for (let i = 0; i < 5; i++) {
            agent.objectives = {
              values: Array.from({ length: 6 }, () => Math.random()),
              timestamp: Date.now(),
            };
          }
          return agent;
        },
        (agent) => agent.objectives.values.length === 6
      );
    });
  });

  describe('state dimension properties', () => {
    it('should respect custom state dimensions', () => {
      forAll(
        () => {
          const dim = Math.floor(Math.random() * 20) + 1;
          return { dim, agent: createAgent(`a${Math.random()}`, randomAgentKind(), dim) };
        },
        ({ dim, agent }) => agent.perception.state.length === dim,
        30
      );
    });

    it('should initialize state with complex numbers', () => {
      forAll(
        () => createAgent(`a${Math.random()}`, randomAgentKind()),
        (agent) => {
          return agent.perception.state.every(
            z => typeof z.re === 'number' && typeof z.im === 'number'
          );
        }
      );
    });
  });
});
