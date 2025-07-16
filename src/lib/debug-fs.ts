import { fsManager } from './fs';

export async function debugProjectFiles(projectId: string) {
  console.log('=== Debugging project files ===');
  console.log('Project ID:', projectId);
  
  try {
    const rootFiles = await fsManager.listFiles(projectId, '');
    console.log('Root files:', rootFiles);
    
    for (const file of rootFiles) {
      const filePath = `${fsManager['dir']}/${projectId}/${file}`;
      try {
        const stat = await fsManager['fs'].promises.stat(filePath);
        console.log(`${file}: ${stat.isDirectory() ? 'directory' : 'file'}`);
        
        if (stat.isDirectory() && file !== '.git') {
          const subFiles = await fsManager.listFiles(projectId, file);
          console.log(`  ${file}/ contents:`, subFiles);
        }
      } catch (error) {
        console.error(`Error accessing ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error listing files:', error);
  }
}