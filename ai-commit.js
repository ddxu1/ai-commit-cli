#!/usr/bin/env node

import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os';

class AICommitCLI {
  constructor() {
    this.anthropic = null;
    this.configPath = path.join(os.homedir(), '.ai-commit-config.json');
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        if (config.apiKey) {
          this.anthropic = new Anthropic({ apiKey: config.apiKey });
        }
      }
    } catch (error) {
      console.log('Error loading config:', error.message);
    }
  }

  saveConfig(apiKey) {
    const config = { apiKey };
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    console.log('✅ API key saved successfully!');
  }

  async setupApiKey() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('Enter your Anthropic API key: ', (apiKey) => {
        rl.close();
        this.saveConfig(apiKey);
        this.anthropic = new Anthropic({ apiKey });
        resolve();
      });
    });
  }

  isGitRepo() {
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  getStagedChanges() {
    try {
      const diff = execSync('git diff --staged', { encoding: 'utf8' });
      return diff;
    } catch (error) {
      throw new Error('Failed to get staged changes: ' + error.message);
    }
  }

  getFileList() {
    try {
      const files = execSync('git diff --staged --name-only', { encoding: 'utf8' });
      return files.trim().split('\n').filter(f => f.length > 0);
    } catch (error) {
      return [];
    }
  }

  getProjectContext() {
    try {
      // Check for common project files to determine project type
      const files = fs.readdirSync('.');
      let projectType = 'general';
      
      if (files.includes('package.json')) {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        if (pkg.dependencies?.react || pkg.devDependencies?.react) {
          projectType = 'React';
        } else if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
          projectType = 'Vue';
        } else if (pkg.dependencies?.express) {
          projectType = 'Node.js/Express';
        } else {
          projectType = 'JavaScript/Node.js';
        }
      } else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
        projectType = 'Python';
      } else if (files.includes('Cargo.toml')) {
        projectType = 'Rust';
      } else if (files.includes('go.mod')) {
        projectType = 'Go';
      }

      return projectType;
    } catch {
      return 'general';
    }
  }

  createPrompt(diff, files, projectType) {
    return `You are an expert developer creating a concise, informative git commit message.

Project type: ${projectType}
Files changed: ${files.join(', ')}

Git diff:
${diff}

Generate a single, clear commit message following these guidelines:
1. Use conventional commit format: type(scope): description
2. Types: feat, fix, docs, style, refactor, test, chore
3. Keep it under 72 characters
4. Be specific about what changed
5. Use present tense ("add" not "added")

Respond with ONLY the commit message, no explanation or quotes.`;
  }

  async generateCommitMessage(diff, files, projectType) {
    const prompt = this.createPrompt(diff, files, projectType);
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.content[0].text.trim();
    } catch (error) {
      throw new Error('Failed to generate commit message: ' + error.message);
    }
  }

  async getUserChoice(message) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      console.log(`\n📝 Suggested commit message:`);
      console.log(`"${message}"`);
      console.log(`\nOptions:`);
      console.log(`[a] Accept  [e] Edit  [r] Regenerate  [c] Cancel`);
      
      rl.question('Choose an option: ', (choice) => {
        rl.close();
        resolve(choice.toLowerCase());
      });
    });
  }

  async getEditedMessage(originalMessage) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`Edit message (current: "${originalMessage}"): `, (newMessage) => {
        rl.close();
        resolve(newMessage || originalMessage);
      });
    });
  }

  commitChanges(message) {
    try {
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
      console.log('\n✅ Changes committed successfully!');
    } catch (error) {
      console.error('❌ Failed to commit:', error.message);
    }
  }

  async run() {
    console.log('🤖 AI Commit Message Generator\n');

    // Check if API key is configured
    if (!this.anthropic) {
      console.log('No API key found. Let\'s set one up:');
      await this.setupApiKey();
    }

    // Check if we're in a git repository
    if (!this.isGitRepo()) {
      console.error('❌ Not a git repository');
      process.exit(1);
    }

    // Check for staged changes
    const diff = this.getStagedChanges();
    if (!diff.trim()) {
      console.error('❌ No staged changes found. Use "git add" to stage files first.');
      process.exit(1);
    }

    const files = this.getFileList();
    const projectType = this.getProjectContext();

    console.log(`📊 Analyzing changes in ${files.length} file(s)...`);
    console.log(`🔍 Project type: ${projectType}`);

    try {
      let commitMessage = await this.generateCommitMessage(diff, files, projectType);
      
      while (true) {
        const choice = await this.getUserChoice(commitMessage);
        
        switch (choice) {
          case 'a':
            this.commitChanges(commitMessage);
            return;
          
          case 'e':
            commitMessage = await this.getEditedMessage(commitMessage);
            break;
          
          case 'r':
            console.log('🔄 Regenerating...');
            commitMessage = await this.generateCommitMessage(diff, files, projectType);
            break;
          
          case 'c':
            console.log('❌ Cancelled');
            return;
          
          default:
            console.log('Invalid option. Please choose a, e, r, or c.');
        }
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

// Run the CLI
const cli = new AICommitCLI();
cli.run();