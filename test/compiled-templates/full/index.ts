// generated code
import { readFileSync } from 'fs';
import dayjs from 'dayjs';
import { generator } from './generator';
if(process.argv.length === 3) {
   const result = generator( JSON.parse(readFileSync(process.argv[2], 'utf-8')), {}, dayjs());
   console.log(JSON.stringify(result, null, 2));
}
else {
   console.log('First argument is path to JSON data file');
}
