// generated code
import { readFileSync } from 'fs';
import { generator } from './generator';
if(process.argv.length === 3) {
   const result = generator( JSON.parse(readFileSync(process.argv[2], 'utf-8')), {}, {});
   console.log(JSON.stringify(result, null, 2));
}
else {
   console.log('First argument is path to JSON data file');
}
