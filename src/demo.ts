/**
 * Meta-League Demo Runner
 * 
 * Demonstrates the "symphony of knowing" - agents evolving on Pareto frontiers
 * with proof-carrying mutations, spectral synchronization, and tri-layer architecture.
 * 
 * Run with: npm run demo
 */

import { evolve, DEFAULT_EVOLUTION_CONFIG, type EvolutionConfig } from './core/metal-league/evolution';
import { generateProofCertificate } from './core/metal-league/proof-gate';

/**
 * Print a fancy header.
 */
function printHeader() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║        🎵  META-LEAGUE EVOLUTION SYMPHONY  🎵                ║
║                                                               ║
║  Agents co-evolving along Pareto frontiers                   ║
║  Learning states in Hilbert space                            ║
║  Proof-carrying mutations with verification gates            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

/**
 * Print evolution stats.
 */
function printStats(result: Awaited<ReturnType<typeof evolve>>) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 EVOLUTION SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n⏱️  Elapsed time: ${result.elapsedMs}ms`);
  console.log(`🧬 Final population: ${result.finalPopulation.length} agents`);
  console.log(`🏆 Pareto frontier: ${result.paretoFront.length} agents`);
  
  console.log('\n📈 Generation-by-Generation Stats:');
  console.log('Gen | Pop | Pareto | Passed | Failed | Avg Gain | Avg Privacy');
  console.log('-'.repeat(70));
  
  for (const stat of result.stats) {
    const avgGain = stat.avgObjectives[0].toFixed(3);
    const avgPrivacy = stat.avgObjectives[4].toFixed(3);
    console.log(
      `${stat.generation.toString().padStart(3)} | ` +
      `${stat.populationSize.toString().padStart(3)} | ` +
      `${stat.paretoFrontSize.toString().padStart(6)} | ` +
      `${stat.passedProofGate.toString().padStart(6)} | ` +
      `${stat.failedProofGate.toString().padStart(6)} | ` +
      `${avgGain.padStart(8)} | ` +
      `${avgPrivacy.padStart(11)}`
    );
  }
  
  console.log('\n🌟 Pareto Champions:');
  for (let i = 0; i < Math.min(3, result.paretoFront.length); i++) {
    const agent = result.paretoFront[i];
    const [gain, latency, engagement, fairness, privacy, cost] = agent.objectives.values;
    
    console.log(`\n  Agent #${i + 1}: ${agent.id}`);
    console.log(`    Generation: ${agent.generation}`);
    console.log(`    Objectives:`);
    console.log(`      Gain:       ${gain.toFixed(4)}`);
    console.log(`      Latency:    ${latency.toFixed(2)}ms`);
    console.log(`      Engagement: ${engagement.toFixed(4)}`);
    console.log(`      Fairness:   ${fairness.toFixed(4)}`);
    console.log(`      Privacy:    ${privacy.toFixed(4)}`);
    console.log(`      Cost:       ${cost.toFixed(4)}`);
    console.log(`    Lineage: ${agent.lineage.slice(-3).join(' → ')}`);
  }
  
  // Show one proof certificate
  if (result.paretoFront.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('📜 SAMPLE PROOF CERTIFICATE (Champion #1)');
    console.log('='.repeat(60));
    console.log(generateProofCertificate(result.paretoFront[0]));
  }
}

/**
 * Main demo runner.
 */
async function main() {
  printHeader();
  
  console.log('🎼 Starting evolution with configuration:');
  console.log(`   Population size: ${DEFAULT_EVOLUTION_CONFIG.populationSize}`);
  console.log(`   Generations: ${DEFAULT_EVOLUTION_CONFIG.generations}`);
  console.log(`   Objectives: ${DEFAULT_EVOLUTION_CONFIG.objectives.length}`);
  console.log(`   State dimension: ${DEFAULT_EVOLUTION_CONFIG.stateDimension}`);
  console.log(`   Crossover rate: ${DEFAULT_EVOLUTION_CONFIG.crossoverRate}`);
  console.log(`   Mutation rate: ${DEFAULT_EVOLUTION_CONFIG.mutationRate}`);
  
  console.log('\n🚀 Beginning evolution...\n');
  
  try {
    const result = await evolve(DEFAULT_EVOLUTION_CONFIG);
    printStats(result);
    
    console.log('\n' + '='.repeat(60));
    console.log('✨ COMPLETE - The orchestra has learned to play together ✨');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Evolution failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch(console.error);
}

export { main };
