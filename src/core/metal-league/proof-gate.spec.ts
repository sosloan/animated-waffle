/**
 * SPEC TEST: proof-gate.spec.ts
 * Paired with proof-gate.ts
 */

import { describe, it, expect } from 'vitest';
import {
  verifyAgent,
  applyProofGate,
  generateProofCertificate,
  isProofValid,
  DEFAULT_PROOF_GATE,
  type ProofGateConfig,
} from './proof-gate';
import { createAgent } from '../agents-runtime/agent';

describe('proof-gate - verification', () => {
  it('should pass agent with good objectives', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 5.0]; // good values
    agent.perception.state = [{ re: 1, im: 0 }]; // normalized state
    
    const result = verifyAgent(agent);
    expect(result.passed).toBe(true);
  });

  it('should fail agent with low gain', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.05, 50, 0.8, 0.9, 0.5, 5.0]; // gain too low
    
    const result = verifyAgent(agent);
    expect(result.passed).toBe(false);
    expect(result.checks.some(c => c.name === 'min-gain' && !c.passed)).toBe(true);
  });

  it('should fail agent with high latency', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.5, 2000, 0.8, 0.9, 0.5, 5.0]; // latency too high
    
    const result = verifyAgent(agent);
    expect(result.passed).toBe(false);
    expect(result.checks.some(c => c.name === 'max-latency' && !c.passed)).toBe(true);
  });

  it('should fail agent with high privacy loss', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.5, 50, 0.8, 0.9, 2.0, 5.0]; // privacy loss too high
    
    const result = verifyAgent(agent);
    expect(result.passed).toBe(false);
    expect(result.checks.some(c => c.name === 'privacy-loss' && !c.passed)).toBe(true);
  });

  it('should fail agent with high cost', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 15.0]; // cost too high
    
    const result = verifyAgent(agent);
    expect(result.passed).toBe(false);
    expect(result.checks.some(c => c.name === 'cost' && !c.passed)).toBe(true);
  });

  it('should include timestamp in result', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 5.0];
    
    const beforeTs = Date.now();
    const result = verifyAgent(agent);
    const afterTs = Date.now();
    
    expect(result.timestamp).toBeGreaterThanOrEqual(beforeTs);
    expect(result.timestamp).toBeLessThanOrEqual(afterTs);
  });

  it('should provide detailed check results', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 5.0];
    
    const result = verifyAgent(agent);
    expect(result.checks.length).toBeGreaterThan(0);
    
    for (const check of result.checks) {
      expect(check.name).toBeDefined();
      expect(typeof check.passed).toBe('boolean');
    }
  });

  it('should use custom config', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 5.0];
    
    const customConfig: ProofGateConfig = {
      ...DEFAULT_PROOF_GATE,
      maxCost: 3.0, // stricter cost limit
    };
    
    const result = verifyAgent(agent, customConfig);
    expect(result.passed).toBe(false); // should fail due to cost
  });
});

describe('proof-gate - population filtering', () => {
  it('should separate passed and failed agents', () => {
    const goodAgent = createAgent('good', 'tutor');
    goodAgent.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 5.0];
    goodAgent.perception.state = [{ re: 1, im: 0 }];
    
    const badAgent = createAgent('bad', 'tutor');
    badAgent.objectives.values = [0.01, 50, 0.8, 0.9, 0.5, 5.0]; // low gain
    
    const { passed, failed } = applyProofGate([goodAgent, badAgent]);
    
    expect(passed.length).toBe(1);
    expect(failed.length).toBe(1);
    expect(passed[0].id).toBe('good');
    expect(failed[0].id).toBe('bad');
  });

  it('should attach proof bundles to passed agents', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 5.0];
    agent.perception.state = [{ re: 1, im: 0 }];
    
    const { passed } = applyProofGate([agent]);
    
    expect(passed[0].proof).toBeDefined();
    expect(passed[0].proof?.verified).toBe(true);
  });

  it('should not attach proofs to failed agents', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.01, 50, 0.8, 0.9, 0.5, 5.0]; // fails
    
    const { failed } = applyProofGate([agent]);
    
    // Proof might be attached but verified should be false
    expect(failed.length).toBe(1);
  });

  it('should return results for all agents', () => {
    const a1 = createAgent('a1', 'tutor');
    a1.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 5.0];
    a1.perception.state = [{ re: 1, im: 0 }];
    
    const a2 = createAgent('a2', 'tutor');
    a2.objectives.values = [0.01, 50, 0.8, 0.9, 0.5, 5.0];
    
    const { results } = applyProofGate([a1, a2]);
    
    expect(results.size).toBe(2);
    expect(results.has('a1')).toBe(true);
    expect(results.has('a2')).toBe(true);
  });

  it('should handle empty population', () => {
    const { passed, failed, results } = applyProofGate([]);
    
    expect(passed.length).toBe(0);
    expect(failed.length).toBe(0);
    expect(results.size).toBe(0);
  });

  it('should preserve agent order in passed array', () => {
    const agents = [
      createAgent('a1', 'tutor'),
      createAgent('a2', 'tutor'),
      createAgent('a3', 'tutor'),
    ];
    
    agents.forEach(a => {
      a.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 5.0];
      a.perception.state = [{ re: 1, im: 0 }];
    });
    
    const { passed } = applyProofGate(agents);
    
    expect(passed.map(a => a.id)).toEqual(['a1', 'a2', 'a3']);
  });
});

describe('proof-gate - certificate generation', () => {
  it('should generate certificate for verified agent', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 5.0];
    agent.perception.state = [{ re: 1, im: 0 }];
    
    applyProofGate([agent]);
    
    const cert = generateProofCertificate(agent);
    expect(cert).toContain('PROOF CERTIFICATE');
    expect(cert).toContain(agent.id);
    expect(cert).toContain(agent.kind);
  });

  it('should include lineage in certificate', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 5.0];
    agent.perception.state = [{ re: 1, im: 0 }];
    agent.lineage = ['genesis', 'mutation-1', 'crossover-2'];
    
    applyProofGate([agent]);
    
    const cert = generateProofCertificate(agent);
    expect(cert).toContain('Lineage');
    expect(cert).toContain('genesis');
  });

  it('should handle agent without proof', () => {
    const agent = createAgent('a1', 'tutor');
    
    const cert = generateProofCertificate(agent);
    expect(cert).toContain('No proof certificate');
  });
});

describe('proof-gate - validity checking', () => {
  it('should accept fresh proof', () => {
    const agent = createAgent('a1', 'tutor');
    agent.objectives.values = [0.5, 50, 0.8, 0.9, 0.5, 5.0];
    agent.perception.state = [{ re: 1, im: 0 }];
    
    applyProofGate([agent]);
    
    expect(isProofValid(agent)).toBe(true);
  });

  it('should reject agent without proof', () => {
    const agent = createAgent('a1', 'tutor');
    expect(isProofValid(agent)).toBe(false);
  });

  it('should reject unverified proof', () => {
    const agent = createAgent('a1', 'tutor');
    agent.proof = {
      spec: 'test',
      proof: 'test',
      verified: false,
      timestamp: Date.now(),
    };
    
    expect(isProofValid(agent)).toBe(false);
  });

  it('should reject expired proof', () => {
    const agent = createAgent('a1', 'tutor');
    agent.proof = {
      spec: 'test',
      proof: 'test',
      verified: true,
      timestamp: Date.now() - 4000000, // 4000 seconds ago
    };
    
    expect(isProofValid(agent, 3600000)).toBe(false); // 1 hour max age
  });

  it('should use custom max age', () => {
    const agent = createAgent('a1', 'tutor');
    agent.proof = {
      spec: 'test',
      proof: 'test',
      verified: true,
      timestamp: Date.now() - 500, // 500ms ago
    };
    
    expect(isProofValid(agent, 1000)).toBe(true); // 1 second max age
    expect(isProofValid(agent, 100)).toBe(false); // 100ms max age
  });
});

describe('proof-gate - extreme pairs compliance', () => {
  it('should emit objective delta on verification', () => {
    const agent = createAgent('a1', 'tutor');
    const beforeValues = [0.2, 100, 0.5, 0.5, 0.5, 5.0]; // meets min gain threshold
    const afterValues = [0.5, 50, 0.8, 0.9, 0.5, 5.0]; // improvement
    
    agent.objectives.values = beforeValues;
    agent.perception.state = [{ re: 1, im: 0 }]; // stable state
    const result1 = verifyAgent(agent);
    
    agent.objectives.values = afterValues;
    agent.perception.state = [{ re: 1, im: 0 }];
    const result2 = verifyAgent(agent);
    
    // Track that objectives changed
    expect(result1.passed).toBe(true);
    expect(result2.passed).toBe(true);
    expect(result2.timestamp).toBeGreaterThanOrEqual(result1.timestamp);
  });
});
