// List available Gemini models
require('dotenv').config();
const axios = require('axios');

async function listGeminiModels() {
  console.log('🔍 Listing available Gemini models...\n');
  console.log('='.repeat(80));
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ ERROR: GEMINI_API_KEY not found in environment variables');
    console.error('   Please set GEMINI_API_KEY in your .env file');
    process.exit(1);
  }
  
  console.log(`✅ API Key found: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log('');
  
  try {
    const response = await axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
      params: {
        key: apiKey
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const models = response.data.models || [];
    
    console.log(`📋 Found ${models.length} total models\n`);
    
    // Filter for Gemini models that support generateContent
    const geminiModels = models
      .filter(model => 
        model.name && 
        model.name.includes('gemini') && 
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map(model => ({
        name: model.name,
        displayName: model.displayName || 'N/A',
        description: model.description || 'N/A',
        supportedMethods: model.supportedGenerationMethods || [],
        inputTokenLimit: model.inputTokenLimit || 'N/A',
        outputTokenLimit: model.outputTokenLimit || 'N/A',
        version: model.version || 'N/A'
      }))
      .sort((a, b) => {
        // Sort by name to group similar models
        return a.name.localeCompare(b.name);
      });
    
    console.log(`🎯 Found ${geminiModels.length} Gemini models that support generateContent:\n`);
    console.log('='.repeat(80));
    
    geminiModels.forEach((model, index) => {
      console.log(`\n${index + 1}. ${model.name}`);
      console.log(`   Display Name: ${model.displayName}`);
      console.log(`   Description: ${model.description.substring(0, 100)}${model.description.length > 100 ? '...' : ''}`);
      console.log(`   Input Tokens: ${model.inputTokenLimit}`);
      console.log(`   Output Tokens: ${model.outputTokenLimit}`);
      console.log(`   Version: ${model.version}`);
      console.log(`   Methods: ${model.supportedMethods.join(', ')}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n💡 RECOMMENDED MODELS FOR SPEED:');
    console.log('   - Look for "flash" in the name (faster, optimized for speed)');
    console.log('   - Look for "lite" in the name (fastest, lowest cost)');
    console.log('   - Avoid "pro" models if speed is priority (they\'re slower but more capable)');
    
    console.log('\n📊 FASTEST MODELS (recommended for keywords):');
    const fastModels = geminiModels.filter(m => 
      m.name.includes('flash') && 
      (m.name.includes('lite') || m.name.includes('1.5') || m.name.includes('2.0'))
    );
    
    if (fastModels.length > 0) {
      fastModels.forEach(model => {
        console.log(`   ✅ ${model.name} - ${model.displayName}`);
      });
    } else {
      console.log('   (No flash models found - check model names above)');
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Export as JSON for easy reference
    console.log('\n📄 Full model list (JSON):');
    console.log(JSON.stringify(geminiModels, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR: Failed to list models');
    console.error('='.repeat(80));
    console.error('Error Message:', error.message);
    console.error('Error Response:', error.response?.data || 'No response data');
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// Run the script
listGeminiModels();
