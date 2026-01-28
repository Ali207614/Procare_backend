const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Function to fix imports in a file
function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Module mappings for correct import paths
  const mappings = {
    // Services
    "from './admins.service'": "from '../../src/admins/admins.service'",
    "from './admins.controller'": "from '../../src/admins/admins.controller'",
    "from './auth.service'": "from '../../src/auth/auth.service'",
    "from './auth.controller'": "from '../../src/auth/auth.controller'",
    "from './branches.service'": "from '../../src/branches/branches.service'",
    "from './branches.controller'": "from '../../src/branches/branches.controller'",
    "from './campaigns.service'": "from '../../src/campaigns/campaigns.service'",
    "from './campaigns.controller'": "from '../../src/campaigns/campaigns.controller'",
    "from './couriers.service'": "from '../../src/couriers/couriers.service'",
    "from './couriers.controller'": "from '../../src/couriers/couriers.controller'",
    "from './notification.service'": "from '../../src/notification/notification.service'",
    "from './notification.controller'": "from '../../src/notification/notification.controller'",
    "from './permissions.service'": "from '../../src/permissions/permissions.service'",
    "from './permissions.controller'": "from '../../src/permissions/permissions.controller'",
    "from './phone-categories.service'": "from '../../src/phone-categories/phone-categories.service'",
    "from './phone-categories.controller'": "from '../../src/phone-categories/phone-categories.controller'",
    "from './phone-os-types.service'": "from '../../src/phone-os-types/phone-os-types.service'",
    "from './phone-os-types.controller'": "from '../../src/phone-os-types/phone-os-types.controller'",
    "from './problem-categories.service'": "from '../../src/problem-categories/problem-categories.service'",
    "from './problem-categories.controller'": "from '../../src/problem-categories/problem-categories.controller'",
    "from './repair-orders.service'": "from '../../src/repair-orders/repair-orders.service'",
    "from './repair-orders.controller'": "from '../../src/repair-orders/repair-orders.controller'",
    "from './repair-parts.service'": "from '../../src/repair-parts/repair-parts.service'",
    "from './repair-parts.controller'": "from '../../src/repair-parts/repair-parts.controller'",
    "from './roles.service'": "from '../../src/roles/roles.service'",
    "from './roles.controller'": "from '../../src/roles/roles.controller'",
    "from './users.service'": "from '../../src/users/users.service'",
    "from './users.controller'": "from '../../src/users/users.controller'",
    "from './logger.service'": "from '../../src/common/logger/logger.service'",
    "from './redis.service'": "from '../../src/common/redis/redis.service'",
    "from './permission.guard'": "from '../../src/common/guards/permission.guard'",

    // DTOs and types
    "from './dto/": "from '../../src/",
    "from '../common/types/": "from '../../src/common/types/",
    "from '../common/guards/": "from '../../src/common/guards/",
    "from '../common/utils/": "from '../../src/common/utils/",
    "from '../common/decorators/": "from '../../src/common/decorators/",
    "from '../common/interceptors/": "from '../../src/common/interceptors/",
  };

  // Apply all mappings
  for (const [oldImport, newImport] of Object.entries(mappings)) {
    content = content.replace(new RegExp(oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newImport);
  }

  // Fix any remaining relative imports that start with ../
  content = content.replace(/from '\.\.\/([^']+)'/g, "from '../../src/$1'");

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed imports in ${filePath}`);
}

// Find all test files and fix them
const testFiles = glob.sync('test/unit/*.spec.ts');
testFiles.forEach(fixImports);

const integrationFiles = glob.sync('test/integration/*.spec.ts');
integrationFiles.forEach(fixImports);

console.log(`Fixed imports in ${testFiles.length + integrationFiles.length} test files`);