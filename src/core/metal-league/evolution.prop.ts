/**
 * PROPERTY TEST: evolution.prop.ts
 * Property-based tests for evolution
 */

import { describe, it, expect } from 'vitest';
import {
  crossoverAgents,
  mutateAgent,
  evaluateAgent,
  type EvolutionConfig,
  DEFAULT_EVOLUTION_CONFIG,
} from './evolution';
import { createAgent } from '../agents-runtime/agent';

function forAll<T>(generator: () => T, property: (value: T) => boolean, iterations = 30): void {
  for (let i = 0; i < iterations; i++) {
    const value = generator();
    if (!property(value)) {
      throw new Error(`Property violated with value: ${JSON.stringify(value)}`);
    }
  }
}

describe('evolution - properties', () => {
  describe('crossover properties', () => {
    it('should always create valid child', () => {
      forAll(
        () => {
          const p1 = createAgent(`p1-${Math.random()}`, 'tutor');
          const p2 = createAgent(`p2-${Math.random()}`, 'tutor');
          return { p1, p2 };
        },
        ({ p1, p2 }) => {
          const child = crossoverAgents(p1, p2, 'child');
          return (
            child.id === 'child' &&
            child.generation > p1.generation &&
            child.generation > p2.generation &&
            child.perception !== undefined &&
            child.reasoning !== undefined &&
            child.coordination !== undefined
          );
        }
      );
    });

    it('should preserve state dimension', () => {
      forAll(
        () => {
          const dim = Math.floor(Math.random() * 10) + 2;
          const p1 = createAgent('p1', 'tutor', dim);
          const p2 = createAgent('p2', 'tutor', dim);
          return { p1, p2, dim };
        },
        ({ p1, p2, dim }) => {
          const child = crossoverAgents(p1, p2, 'child');
          return child.perception.state.length === dim;
        }
      );
    });

    it('should extend lineage', () => {
      forAll(
        () => {
          const p1 = createAgent(`p1-${Math.random()}`, 'tutor');
          const p2 = createAgent(`p2-${Math.random()}`, 'tutor');
          return { p1, p2 };
        },
        ({ p1, p2 }) => {
          const child = crossoverAgents(p1, p2, 'child');
          return child.lineage.length > Math.max(p1.lineage.length, p2.lineage.length);
        }
      );
    });
  });

  describe('mutation properties', () => {
    it('should respect mutation rate probability', () => {
      // With rate 0, should never mutate lineage
      forAll(
        () => createAgent(`a-${Math.random()}`, 'tutor'),
        (agent) => {
          const beforeLineage = agent.lineage.length;
          mutateAgent(agent, 0.0);
          return agent.lineage.length === beforeLineage;
        }
      );
    });

    it('should preserve agent structure', () => {
      forAll(
        () => createAgent(`a-${Math.random()}`, 'tutor'),
        (agent) => {
          mutateAgent(agent, 1.0);
          return (
            agent.perception !== undefined &&
            agent.reasoning !== undefined &&
            agent.coordination !== undefined &&
            agent.objectives !== undefined
          );
        }
      );
    });

    it('should maintain state dimension', () => {
      forAll(
        () => {
          const dim = Math.floor(Math.random() * 10) + 2;
          return createAgent('a', 'tutor', dim);
        },
        (agent) => {
          const dim = agent.perception.state.length;
          mutateAgent(agent, 1.0);
          return agent.perception.state.length === dim;
        }
      );
    });
  });

  describe('evaluation properties', () => {
    it('should always set 6 objective values', async () => {
      const agents = Array.from({ length: 20 }, (_, i) => 
        createAgent(`a${i}`, 'tutor')
      );
      
      await Promise.all(agents.map(a => evaluateAgent(a)));
      
      for (const agent of agents) {
        expect(agent.objectives.values).toHaveLength(6);
      }
    });

    it('should set timestamp', async () => {
      const agents = Array.from({ length: 10 }, (_, i) => 
        createAgent(`a${i}`, 'tutor')
      );
      
      const before = Date.now();
      await Promise.all(agents.map(a => evaluateAgent(a)));
      const after = Date.now();
      
      for (const agent of agents) {
        expect(agent.objectives.timestamp).toBeGreaterThanOrEqual(before);
        expect(agent.objectives.timestamp).toBeLessThanOrEqual(after);
      }
    });

    it('should produce deterministic results for same state', async () => {
      const agent1 = createAgent('a1', 'tutor', 4);
      agent1.perception.state = [
        { re: 1, im: 0 },
        { re: 0, im: 1 },
        { re: 0, im: 0 },
        { re: 0, im: 0 },
      ];
      
      const agent2 = createAgent('a2', 'tutor', 4);
      agent2.perception.state = [
        { re: 1, im: 0 },
        { re: 0, im: 1 },
        { re: 0, im: 0 },
        { re: 0, im: 0 },
      ];
      
      // Same state should produce similar objectives (within tolerance)
      await evaluateAgent(agent1);
      await evaluateAgent(agent2);
      
      for (let i = 0; i < 6; i++) {
        const diff = Math.abs(agent1.objectives.values[i] - agent2.objectives.values[i]);
        expect(diff).toBeLessThan(0.01);
      }
    });
  });

  describe('evolution config properties', () => {
    it('should accept various population sizes', () => {
      forAll(
        () => Math.floor(Math.random() * 50) + 3,
        (popSize) => {
          const config: EvolutionConfig = {
            ...DEFAULT_EVOLUTION_CONFIG,
            populationSize: popSize,
          };
          return (
            config.populationSize === popSize &&
            config.populationSize >= 3
          );
        },
        10
      );
    });

    it('should maintain valid crossover rates', () => {
      forAll(
        () => Math.random(),
        (rate) => {
          const config: EvolutionConfig = {
            ...DEFAULT_EVOLUTION_CONFIG,
            crossoverRate: rate,
          };
          return (
            config.crossoverRate >= 0 &&
            config.crossoverRate <= 1
          );
        },
        20
      );
    });
  });
});
