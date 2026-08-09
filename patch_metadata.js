const fs = require('fs');
const path = require('path');

const metadataDir = path.join(__dirname, 'nhost/metadata/databases/default/tables');
const files = fs.readdirSync(metadataDir).filter(f => f.startsWith('public_') && f.endsWith('.yaml'));

for (const file of files) {
  const filePath = path.join(metadataDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // We are going to strictly replace the word 'viewer' (or 'editor' or 'owner') with 'user' 
  // and append the block to the end of the permissions array.
  
  if (!content.includes('role: user\n')) {
    let sourceRole = 'role: editor\n';
    if (!content.includes(sourceRole)) sourceRole = 'role: viewer\n';
    if (!content.includes(sourceRole)) sourceRole = 'role: owner\n';

    if (content.includes(sourceRole)) {
      // Very naive duplication:
      // Replace role: editor with role: user for the ENTIRE file's editor blocks and append it
      // Wait, we need to inject it properly into the YAML array.
      
      const permTypes = ['select_permissions:', 'insert_permissions:', 'update_permissions:', 'delete_permissions:'];
      let changed = false;
      
      for (const permType of permTypes) {
         if (content.includes(permType)) {
            // Find the index of permType
            const typeIndex = content.indexOf(permType);
            
            // Find the end of this block
            let nextTypeIndex = content.length;
            for (const other of permTypes) {
               if (other !== permType && content.indexOf(other) > typeIndex) {
                   if (content.indexOf(other) < nextTypeIndex) {
                       nextTypeIndex = content.indexOf(other);
                   }
               }
            }
            
            const blockContent = content.substring(typeIndex, nextTypeIndex);
            
            let sourceRoleStr = '  - role: editor';
            if (!blockContent.includes(sourceRoleStr)) sourceRoleStr = '  - role: viewer';
            if (!blockContent.includes(sourceRoleStr)) sourceRoleStr = '  - role: owner';
            
            if (blockContent.includes(sourceRoleStr)) {
               const lines = blockContent.split('\n');
               let blockToAdd = [];
               let capturing = false;
               for (const line of lines) {
                  if (line.startsWith(sourceRoleStr)) {
                     capturing = true;
                     blockToAdd.push(line.replace(sourceRoleStr, '  - role: user'));
                  } else if (capturing) {
                     if (line.startsWith('  - role: ') || line.trim() === '' || (!line.startsWith(' ') && line.length > 0)) {
                        capturing = false;
                     } else {
                        blockToAdd.push(line);
                     }
                  }
               }
               
               if (blockToAdd.length > 0) {
                  // Append to the end of the blockContent
                  const newBlockContent = blockContent.trimEnd() + '\n' + blockToAdd.join('\n') + '\n';
                  content = content.replace(blockContent, newBlockContent);
                  changed = true;
               }
            }
         }
      }
      
      if (changed) {
         fs.writeFileSync(filePath, content);
         console.log(`Updated ${file}`);
      }
    }
  }
}
