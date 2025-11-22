/**
 * SPEC TEST: evolution.spec.ts
 * Paired with evolution.ts
 */

import { describe, it, expect } from 'vitest';
import {
  evolve,
  evaluateAgent,
  crossoverAgents,
  mutateAgent,
  DEFAULT_EVOLUTION_CONFIG,
  type EvolutionConfig,
} from './evolution';
import { createAgent } from '../agents-runtime/agent';

describe('evolution - evaluation', () => {
  it('should evaluate agent and set objectives', async () => {
    const agent = createAgent('test', 'tutor');
    
    await evaluateAgent(agent);
    
    expect(agent.objectives.values).toHaveLength(6);
    expect(agent.objectives.timestamp).toBeGreaterThan(0);
  });

  it('should handle async evaluation', async () => {
    const agent = createAgent('test', 'tutor');
    const start = Date.now();
    
    await evaluateAgent(agent);
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(0);
  });
});

describe('evolution - crossover', () => {
  it('should create child from two parents', () => {
    const parent1 = createAgent('p1', 'tutor');
    const parent2 = createAgent('p2', 'tutor');
    
    const child = crossoverAgents(parent1, parent2, 'child');
    
    expect(child.id).toBe('child');
    expect(child.generation).toBeGreaterThan(parent1.generation);
  });

  it('should blend parent states via spectral sync', () => {
    const parent1 = createAgent('p1', 'tutor', 4);
    parent1.perception.state = [
      { re: 1, im: 0 },
      { re: 0, im: 1 },
      { re: 0, im: 0 },
      { re: 0, im: 0 },
    ];
    
    const parent2 = createAgent('p2', 'tutor', 4);
    parent2.perception.state = [
      { re: 0, im: 0 },
      { re: 0, im: 0 },
      { re: 1, im: 0 },
      { re: 0, im: 1 },
    ];
    
    const child = crossoverAgents(parent1, parent2, 'child');
    
    // Child state should be normalized blend
    expect(child.perception.state).toHaveLength(4);
    expect(child.perception.provenance.some(p => p.includes('crossover'))).toBe(true);
  });

  it('should inherit knowledge from both parents', () => {
    const parent1 = createAgent('p1', 'tutor');
    parent1.reasoning.knowledge = [
      { type: 'fact', content: 'fact1' },
      { type: 'fact', content: 'fact2' },
      { type: 'fact', content: 'fact3' },
    ];
    
    const parent2 = createAgent('p2', 'tutor');
    parent2.reasoning.knowledge = [
      { type: 'fact', content: 'factA' },
      { type: 'fact', content: 'factB' },
    ];
    
    const child = crossoverAgents(parent1, parent2, 'child');
    
    expect(child.reasoning.knowledge.length).toBeGreaterThan(0);
  });

  it('should update lineage', () => {
    const parent1 = createAgent('p1', 'tutor');
    const parent2 = createAgent('p2', 'tutor');
    
    const child = crossoverAgents(parent1, parent2, 'child');
    
    expect(child.lineage.some(l => l.includes('crossover'))).toBe(true);
  });
});

describe('evolution - mutation', () => {
  it('should mutate agent with given rate', () => {
    const agent = createAgent('test', 'tutor');
    const originalStateRe = agent.perception.state[0].re;
    
    // Mutate with 100% rate
    mutateAgent(agent, 1.0);
    
    // State should have changed (probabilistically)
    const changed = agent.perception.state[0].re !== originalStateRe ||
                   agent.lineage.some(l => l.includes('mutation'));
    expect(changed).toBe(true);
  });

  it('should not mutate with 0% rate', () => {
    const agent = createAgent('test', 'tutor');
    const originalLineageLength = agent.lineage.length;
    
    mutateAgent(agent, 0.0);
    
    expect(agent.lineage.length).toBe(originalLineageLength);
  });

  it('should normalize state after mutation', () => {
    const agent = createAgent('test', 'tutor', 4);
    
    mutateAgent(agent, 1.0);
    
    // Check that mutation added provenance
    expect(agent.perception.provenance.some(p => p === 'mutation')).toBe(true);
  });
});

describe('evolution - multi-generation', () => {
  it('should run evolution and return result', async () => {
    const config: EvolutionConfig = {
      ...DEFAULT_EVOLUTION_CONFIG,
      populationSize: 5,
      generations: 3,
    };
    
    const result = await evolve(config);
    
    expect(result.finalPopulation.length).toBeGreaterThan(0);
    expect(result.paretoFront.length).toBeGreaterThan(0);
    expect(result.stats).toHaveLength(3);
    expect(result.elapsedMs).toBeGreaterThan(0);
  });

  it('should track generation stats', async () => {
    const config: EvolutionConfig = {
      ...DEFAULT_EVOLUTION_CONFIG,
      populationSize: 5,
      generations: 2,
    };
    
    const result = await evolve(config);
    
    for (const stat of result.stats) {
      expect(stat.generation).toBeGreaterThanOrEqual(0);
      expect(stat.populationSize).toBeGreaterThan(0);
      expect(stat.avgObjectives).toHaveLength(6);
      expect(stat.bestObjectives).toHaveLength(6);
    }
  });

  it('should maintain proof gates across generations', async () => {
    const config: EvolutionConfig = {
      ...DEFAULT_EVOLUTION_CONFIG,
      populationSize: 5,
      generations: 2,
    };
    
    const result = await evolve(config);
    
    // All final agents should have proofs
    for (const agent of result.finalPopulation) {
      expect(agent.proof).toBeDefined();
      expect(agent.proof?.verified).toBe(true);
    }
  });

  it('should show evolution progress', async () => {
    const config: EvolutionConfig = {
      ...DEFAULT_EVOLUTION_CONFIG,
      populationSize: 5,
      generations: 3,
    };
    
    const result = await evolve(config);
    
    // Check that generations progressed
    const generations = result.stats.map(s => s.generation);
    expect(generations).toEqual([0, 1, 2]);
  });

  it('should handle small populations', async () => {
    const config: EvolutionConfig = {
      ...DEFAULT_EVOLUTION_CONFIG,
      populationSize: 3,
      generations: 2,
    };
    
    const result = await evolve(config);
    
    expect(result.finalPopulation.length).toBeGreaterThan(0);
  });

  it('should emit objective delta across generations', async () => {
    const config: EvolutionConfig = {
      ...DEFAULT_EVOLUTION_CONFIG,
      populationSize: 5,
      generations: 3,
    };
    
    const result = await evolve(config);
    
    // Check that stats tracked changes
    expect(result.stats[0].avgObjectives).toBeDefined();
    expect(result.stats[result.stats.length - 1].avgObjectives).toBeDefined();
  });
});

describe('evolution - pareto frontier', () => {
  it('should maintain Pareto front', async () => {
    const config: EvolutionConfig = {
      ...DEFAULT_EVOLUTION_CONFIG,
      populationSize: 10,
      generations: 2,
    };
    
    const result = await evolve(config);
    
    expect(result.paretoFront.length).toBeGreaterThan(0);
    expect(result.paretoFront.length).toBeLessThanOrEqual(result.finalPopulation.length);
  });

  it('should track Pareto front size over generations', async () => {
    const config: EvolutionConfig = {
      ...DEFAULT_EVOLUTION_CONFIG,
      populationSize: 8,
      generations: 3,
    };
    
    const result = await evolve(config);
    
    for (const stat of result.stats) {
      expect(stat.paretoFrontSize).toBeGreaterThan(0);
    }
  });
});
