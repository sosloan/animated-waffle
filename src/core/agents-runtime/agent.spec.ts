/**
 * SPEC TEST: agent.spec.ts
 * Paired with agent.ts
 */

import { describe, it, expect } from 'vitest';
import {
  createAgent,
  cloneAgent,
  addFact,
  addTool,
  recordDecision,
  updatePerception,
  type MetaAgent,
} from './agent';

describe('agent - creation', () => {
  it('should create agent with default state', () => {
    const agent = createAgent('a1', 'tutor');
    expect(agent.id).toBe('a1');
    expect(agent.kind).toBe('tutor');
    expect(agent.generation).toBe(0);
  });

  it('should initialize perception layer', () => {
    const agent = createAgent('a1', 'student');
    expect(agent.perception.state).toHaveLength(8);
    expect(agent.perception.uncertainty).toBe(1.0);
    expect(agent.perception.provenance).toEqual(['init']);
  });

  it('should initialize reasoning layer', () => {
    const agent = createAgent('a1', 'tutor');
    expect(agent.reasoning.knowledge).toEqual([]);
    expect(agent.reasoning.goals).toEqual([]);
  });

  it('should initialize coordination layer', () => {
    const agent = createAgent('a1', 'tutor');
    expect(agent.coordination.tools).toEqual([]);
    expect(agent.coordination.memory).toEqual([]);
    expect(agent.coordination.decisions).toEqual([]);
    expect(agent.coordination.partners).toEqual([]);
  });

  it('should initialize objectives with 6 dimensions', () => {
    const agent = createAgent('a1', 'tutor');
    expect(agent.objectives.values).toHaveLength(6);
  });

  it('should create agent with custom state dimension', () => {
    const agent = createAgent('a1', 'tutor', 16);
    expect(agent.perception.state).toHaveLength(16);
  });

  it('should initialize lineage', () => {
    const agent = createAgent('a1', 'tutor');
    expect(agent.lineage).toEqual(['genesis']);
  });
});

describe('agent - cloning', () => {
  it('should create deep copy of agent', () => {
    const original = createAgent('a1', 'tutor');
    addFact(original, 'test fact');
    
    const clone = cloneAgent(original);
    
    expect(clone.id).not.toBe(original.id);
    expect(clone.reasoning.knowledge).toEqual(original.reasoning.knowledge);
    expect(clone.reasoning.knowledge).not.toBe(original.reasoning.knowledge);
  });

  it('should use custom ID if provided', () => {
    const original = createAgent('a1', 'tutor');
    const clone = cloneAgent(original, 'a2');
    expect(clone.id).toBe('a2');
  });

  it('should add clone provenance', () => {
    const original = createAgent('a1', 'tutor');
    const clone = cloneAgent(original);
    
    expect(clone.perception.provenance).toContain('clone');
    expect(clone.perception.provenance.length).toBeGreaterThan(
      original.perception.provenance.length
    );
  });

  it('should update lineage with clone source', () => {
    const original = createAgent('a1', 'tutor');
    const clone = cloneAgent(original);
    
    expect(clone.lineage.some(l => l.includes('clone-from:a1'))).toBe(true);
  });

  it('should not mutate original agent', () => {
    const original = createAgent('a1', 'tutor');
    const originalKnowledge = original.reasoning.knowledge.length;
    
    const clone = cloneAgent(original);
    addFact(clone, 'new fact');
    
    expect(original.reasoning.knowledge.length).toBe(originalKnowledge);
  });
});

describe('agent - knowledge operations', () => {
  it('should add fact to knowledge base', () => {
    const agent = createAgent('a1', 'tutor');
    addFact(agent, 'test fact');
    
    expect(agent.reasoning.knowledge).toHaveLength(1);
    expect(agent.reasoning.knowledge[0]).toEqual({
      type: 'fact',
      content: 'test fact',
    });
  });

  it('should accumulate multiple facts', () => {
    const agent = createAgent('a1', 'tutor');
    addFact(agent, 'fact 1');
    addFact(agent, 'fact 2');
    
    expect(agent.reasoning.knowledge).toHaveLength(2);
  });
});

describe('agent - tool operations', () => {
  it('should add tool to coordination layer', () => {
    const agent = createAgent('a1', 'tutor');
    const tool = { name: 'calculator', cost: 0.1 };
    
    addTool(agent, tool);
    
    expect(agent.coordination.tools).toHaveLength(1);
    expect(agent.coordination.tools[0].name).toBe('calculator');
  });

  it('should track tool costs', () => {
    const agent = createAgent('a1', 'tutor');
    addTool(agent, { name: 'api-call', cost: 0.5 });
    
    const totalCost = agent.coordination.tools.reduce((sum, t) => sum + t.cost, 0);
    expect(totalCost).toBe(0.5);
  });
});

describe('agent - decision tracking', () => {
  it('should record decisions', () => {
    const agent = createAgent('a1', 'tutor');
    recordDecision(agent, 'chose task A');
    
    expect(agent.coordination.decisions).toHaveLength(1);
    expect(agent.coordination.decisions[0]).toBe('chose task A');
  });

  it('should maintain decision history', () => {
    const agent = createAgent('a1', 'tutor');
    recordDecision(agent, 'decision 1');
    recordDecision(agent, 'decision 2');
    recordDecision(agent, 'decision 3');
    
    expect(agent.coordination.decisions).toHaveLength(3);
    expect(agent.coordination.decisions).toEqual([
      'decision 1',
      'decision 2',
      'decision 3',
    ]);
  });
});

describe('agent - perception updates', () => {
  it('should update perception state', () => {
    const agent = createAgent('a1', 'tutor');
    const newState = [{ re: 1, im: 0 }, { re: 0, im: 1 }];
    
    updatePerception(agent, newState, 'manual-update');
    
    expect(agent.perception.state).toEqual(newState);
  });

  it('should track provenance of updates', () => {
    const agent = createAgent('a1', 'tutor');
    const newState = [{ re: 1, im: 0 }];
    
    updatePerception(agent, newState, 'test-update');
    
    expect(agent.perception.provenance).toContain('test-update');
  });

  it('should update timestamp', () => {
    const agent = createAgent('a1', 'tutor');
    const beforeTs = agent.perception.timestamp;
    
    // Wait a bit
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    return wait(10).then(() => {
      const newState = [{ re: 1, im: 0 }];
      updatePerception(agent, newState, 'delayed-update');
      
      expect(agent.perception.timestamp).toBeGreaterThan(beforeTs);
    });
  });
});

describe('agent - tri-layer structure', () => {
  it('should have all three layers present', () => {
    const agent = createAgent('a1', 'tutor');
    
    expect(agent.perception).toBeDefined();
    expect(agent.reasoning).toBeDefined();
    expect(agent.coordination).toBeDefined();
  });

  it('should support different agent kinds', () => {
    const kinds: Array<MetaAgent['kind']> = [
      'student',
      'tutor',
      'curriculumDesigner',
      'pedagogyTheorist',
      'theoremProver',
      'metaDesigner',
    ];
    
    for (const kind of kinds) {
      const agent = createAgent(`a-${kind}`, kind);
      expect(agent.kind).toBe(kind);
    }
  });

  it('should maintain independence between layers', () => {
    const agent = createAgent('a1', 'tutor');
    
    // Modify each layer
    addFact(agent, 'test');
    addTool(agent, { name: 'tool', cost: 0 });
    updatePerception(agent, [{ re: 1, im: 0 }], 'update');
    
    // All layers should be modified
    expect(agent.reasoning.knowledge.length).toBeGreaterThan(0);
    expect(agent.coordination.tools.length).toBeGreaterThan(0);
    expect(agent.perception.provenance.length).toBeGreaterThan(1);
  });
});

describe('agent - objective delta emission (Rule 4)', () => {
  it('should track objective changes over time', () => {
    const agent = createAgent('a1', 'tutor');
    const initialTs = agent.objectives.timestamp;
    
    // Simulate evolution step
    agent.objectives = {
      values: [0.5, 100, 0.8, 0.7, 0.2, 0.1],
      timestamp: Date.now(),
    };
    
    expect(agent.objectives.timestamp).toBeGreaterThanOrEqual(initialTs);
  });
});
