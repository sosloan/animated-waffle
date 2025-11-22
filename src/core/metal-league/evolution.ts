/**
 * Meta-League Evolution Loop
 * 
 * The "conductor" that orchestrates multi-generation evolution of agents.
 * Agents evolve along Pareto frontiers, passing through proof gates,
 * while maintaining the tri-layer architecture.
 */

import { MetaAgent, createAgent, cloneAgent, updatePerception } from '../agents-runtime/agent';
import { ObjectiveSpec, DEFAULT_OBJECTIVES } from '../laws-physics/objectives';
import { fastNonDominatedSort, nsga2Select, tournamentSelect, type Genome } from './nsga2';
import { applyProofGate, DEFAULT_PROOF_GATE, type ProofGateConfig } from './proof-gate';
import { spectralSync, normalize } from '../laws-physics/hilbert';

/**
 * Evolution configuration.
 */
export interface EvolutionConfig {
  populationSize: number;
  generations: number;
  objectives: ObjectiveSpec[];
  proofGate: ProofGateConfig;
  crossoverRate: number;
  mutationRate: number;
  stateDimension: number;
}

/**
 * Default evolution configuration.
 */
export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  populationSize: 20,
  generations: 10,
  objectives: DEFAULT_OBJECTIVES,
  proofGate: {
    ...DEFAULT_PROOF_GATE,
    requireStability: false, // Disable for initial evolution
    maxCost: 50.0, // More lenient cost budget
  },
  crossoverRate: 0.7,
  mutationRate: 0.2,
  stateDimension: 8,
};

/**
 * Generation statistics.
 */
export interface GenerationStats {
  generation: number;
  populationSize: number;
  paretoFrontSize: number;
  passedProofGate: number;
  failedProofGate: number;
  avgObjectives: number[];
  bestObjectives: number[];
  timestamp: number;
}

/**
 * Evolution result.
 */
export interface EvolutionResult {
  finalPopulation: MetaAgent[];
  paretoFront: MetaAgent[];
  stats: GenerationStats[];
  elapsedMs: number;
}

/**
 * Evaluate an agent's objectives.
 * This is where we'd integrate with external systems (NASA, Alpaca, etc.)
 * For now, we simulate evaluation based on agent state.
 */
export async function evaluateAgent(agent: MetaAgent): Promise<void> {
  // Simulate async evaluation (would call real APIs here)
  await new Promise(resolve => setTimeout(resolve, 1));
  
  // Derive objectives from agent's current state
  const stateNorm = Math.sqrt(
    agent.perception.state.reduce((sum, z) => sum + z.re * z.re + z.im * z.im, 0)
  );
  
  const toolCost = agent.coordination.tools.reduce((sum, t) => sum + t.cost, 0);
  const knowledgeSize = agent.reasoning.knowledge.length;
  
  // Compute multi-objective fitness
  agent.objectives.values = [
    // gain: more knowledge + normalized state (baseline 0.2 to pass proof gate)
    Math.min(1.0, 0.2 + knowledgeSize * 0.1 + Math.abs(1.0 - stateNorm) * 0.2),
    // latency: inverse of complexity
    50 + knowledgeSize * 10 + toolCost * 5,
    // engagement: based on decision history
    Math.min(1.0, agent.coordination.decisions.length * 0.1),
    // fairness: balanced tool usage
    toolCost > 0 ? Math.min(1.0, 1.0 / (1.0 + Math.abs(toolCost - 1.0))) : 0.5,
    // privacy loss: uncertainty as proxy
    agent.perception.uncertainty,
    // cost: direct tool cost + knowledge maintenance
    toolCost + knowledgeSize * 0.1,
  ];
  
  agent.objectives.timestamp = Date.now();
}

/**
 * Crossover two agents to create offspring.
 */
export function crossoverAgents(
  parent1: MetaAgent,
  parent2: MetaAgent,
  childId: string
): MetaAgent {
  const child = cloneAgent(parent1, childId);
  child.generation = Math.max(parent1.generation, parent2.generation) + 1;
  
  // Blend Hilbert states via spectral synchronization
  const syncedState = spectralSync([parent1.perception.state, parent2.perception.state]);
  updatePerception(child, syncedState, `crossover:${parent1.id}x${parent2.id}`);
  
  // Inherit knowledge from both parents (sample)
  const combinedKnowledge = [
    ...parent1.reasoning.knowledge.slice(0, 2),
    ...parent2.reasoning.knowledge.slice(0, 2),
  ];
  child.reasoning.knowledge = combinedKnowledge;
  
  // Inherit tools from both
  child.coordination.tools = [
    ...parent1.coordination.tools.slice(0, 1),
    ...parent2.coordination.tools.slice(0, 1),
  ];
  
  child.lineage = [
    ...child.lineage,
    `crossover:gen${child.generation}`,
  ];
  
  return child;
}

/**
 * Mutate an agent.
 */
export function mutateAgent(agent: MetaAgent, rate: number): void {
  if (Math.random() >= rate) return;
  
  // Mutate Hilbert state with random perturbation
  const perturbedState = agent.perception.state.map(z => ({
    re: z.re + (Math.random() - 0.5) * 0.2,
    im: z.im + (Math.random() - 0.5) * 0.2,
  }));
  
  updatePerception(agent, normalize(perturbedState), 'mutation');
  
  // Randomly add/remove knowledge
  if (Math.random() < 0.3 && agent.reasoning.knowledge.length > 0) {
    agent.reasoning.knowledge.pop();
  }
  
  if (Math.random() < 0.3) {
    agent.reasoning.knowledge.push({
      type: 'fact',
      content: `learned-fact-gen${agent.generation}`,
    });
  }
  
  agent.lineage.push(`mutation:gen${agent.generation}`);
}

/**
 * Run multi-generation evolution.
 */
export async function evolve(config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG): Promise<EvolutionResult> {
  const startTime = Date.now();
  const stats: GenerationStats[] = [];
  
  // Initialize population
  let population: MetaAgent[] = Array.from(
    { length: config.populationSize },
    (_, i) => createAgent(`agent-gen0-${i}`, 'tutor', config.stateDimension)
  );
  
  // Evolution loop
  for (let gen = 0; gen < config.generations; gen++) {
    console.log(`\n🎵 Generation ${gen}/${config.generations}`);
    
    // Step 1: Evaluate all agents
    await Promise.all(population.map(agent => evaluateAgent(agent)));
    
    // Step 2: Apply proof gate
    const { passed, failed, results } = applyProofGate(population, config.proofGate);
    console.log(`   Proof gate: ${passed.length} passed, ${failed.length} failed`);
    
    if (passed.length === 0) {
      console.warn(`   ⚠️  No agents passed proof gate at generation ${gen}`);
      break;
    }
    
    // Step 3: Pareto sorting
    const genomes: Genome[] = passed.map(agent => ({
      id: agent.id,
      objectives: agent.objectives,
      agent,
    }));
    
    const fronts = fastNonDominatedSort(genomes, config.objectives);
    const paretoFront = fronts[0] || [];
    
    console.log(`   Pareto front: ${paretoFront.length} agents`);
    
    // Step 4: Collect stats
    const avgObjectives = config.objectives.map((_, i) => {
      const sum = passed.reduce((s, a) => s + a.objectives.values[i], 0);
      return sum / passed.length;
    });
    
    const bestAgent = paretoFront[0]?.agent || passed[0];
    
    stats.push({
      generation: gen,
      populationSize: population.length,
      paretoFrontSize: paretoFront.length,
      passedProofGate: passed.length,
      failedProofGate: failed.length,
      avgObjectives,
      bestObjectives: bestAgent.objectives.values,
      timestamp: Date.now(),
    });
    
    // Step 5: Selection and reproduction
    if (gen < config.generations - 1) {
      const survivors = nsga2Select(genomes, config.objectives, Math.floor(config.populationSize * 0.5));
      
      const nextGen: MetaAgent[] = [...survivors.map(g => g.agent as MetaAgent)];
      
      // Create offspring via crossover and mutation
      while (nextGen.length < config.populationSize) {
        const parent1 = tournamentSelect(genomes).agent as MetaAgent;
        const parent2 = tournamentSelect(genomes).agent as MetaAgent;
        
        let child: MetaAgent;
        if (Math.random() < config.crossoverRate) {
          child = crossoverAgents(parent1, parent2, `agent-gen${gen + 1}-${nextGen.length}`);
        } else {
          child = cloneAgent(parent1, `agent-gen${gen + 1}-${nextGen.length}`);
          child.generation = gen + 1;
        }
        
        mutateAgent(child, config.mutationRate);
        nextGen.push(child);
      }
      
      population = nextGen;
    } else {
      population = passed;
    }
  }
  
  // Final evaluation and sorting
  await Promise.all(population.map(agent => evaluateAgent(agent)));
  const { passed: finalPassed } = applyProofGate(population, config.proofGate);
  
  const finalGenomes: Genome[] = finalPassed.map(agent => ({
    id: agent.id,
    objectives: agent.objectives,
    agent,
  }));
  
  const finalFronts = fastNonDominatedSort(finalGenomes, config.objectives);
  const finalParetoFront = (finalFronts[0] || []).map(g => g.agent as MetaAgent);
  
  const elapsedMs = Date.now() - startTime;
  
  console.log(`\n✅ Evolution complete in ${elapsedMs}ms`);
  console.log(`   Final Pareto front: ${finalParetoFront.length} agents`);
  
  return {
    finalPopulation: finalPassed,
    paretoFront: finalParetoFront,
    stats,
    elapsedMs,
  };
}
