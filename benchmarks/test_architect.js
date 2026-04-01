import { CriticalArchitectTool } from '../src/tools/CriticalArchitectTool.js';

async function runTest() {
  const architect = new CriticalArchitectTool();
  
  console.log('=== CriticalArchitectTool Test ===\n');
  
  const badProposal = "I want to store user passwords in plain text in a global JavaScript array so that we can quickly check them during login without hitting the database. It will be super fast!";
  
  console.log(`User Proposal: "${badProposal}"\n`);
  console.log('Architect is analyzing...\n');
  
  const result = await architect.execute({ proposal: badProposal });
  
  console.log(result);
}

runTest().catch(console.error);
