// generated code, do not modify

// IMPORTS
import * as CommonMark from './org.accordproject.commonmark@0.5.0';
import * as CiceroMark from './org.accordproject.ciceromark@0.6.0';
import * as TemplateModel from './test@1.0.0';
import dayjs from 'dayjs';
import * as UserCode from './usercode';
import { getDrafter as $getDrafter } from './runtime/drafting';
import * as Runtime from './runtime/TypeScriptRuntime';

// GENERATOR
export function generator(data:TemplateModel.ITemplateData, library:any, now:dayjs.Dayjs) : CommonMark.IDocument {
const docNode = {$class: 'org.accordproject.commonmark@0.5.0.Document', xmlns: 'org.accordproject.commonmark@0.5.0', nodes: []} as CommonMark.INode;
const $nodes:CommonMark.INode[] = [];
const $data:any[] = [];
let $result:any = docNode;
Runtime.push($data, data);
   // start processing Document
      // ContractDefinition (top)
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.ciceromark@0.6.0.Contract","name":"top","nodes":[]} as CiceroMark.IContract;
      })();
      Runtime.addChild($nodes, $result);
      // Heading 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Heading","level":"1"} as CommonMark.IHeading;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Welcome!","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Hello ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // VariableDefinition (firstName)
      Runtime.push($nodes, $result);
      $result = (() => {
      Runtime.push($data, Runtime.peekProperty($data, 'firstName', false));
      const text = JSON.stringify(Runtime.peek($data)) as string;
      Runtime.pop($data);
      const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"firstName"};
      variable.value = text;
      return variable as CiceroMark.IVariable;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":" ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // JoinDefinition (middleNames)
      Runtime.push($nodes, $result);
      $result = (() => {
      Runtime.push($data, Runtime.peekProperty($data, 'middleNames', false));
      const text = Runtime.peek($data).join('-');
      Runtime.pop($data);
      return { $class: 'org.accordproject.commonmark@0.5.0.Text', text: text } as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":" ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // ConditionalDefinition (lastName)
      Runtime.push($nodes, $result);
      $result = (() => {
      const isTrue:boolean = UserCode.condition_nodes_0_nodes_1_nodes_5(data,library,now)
      const curNode = {"$class":"org.accordproject.ciceromark@0.6.0.Conditional","whenTrue":[{"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Mister"}],"whenFalse":[{"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Dude"}],"name":"lastName","isTrue":true} as CiceroMark.IConditional;
      (curNode as CiceroMark.IConditional).isTrue = isTrue;
      return curNode;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"!","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Heading 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Heading","level":"2"} as CommonMark.IHeading;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Middle Names","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // ListBlockDefinition (middleNames)
      Runtime.push($nodes, $result);
      Runtime.push($data, Runtime.peekProperty($data, 'middleNames', false));
      $result = (() => {
      const result = {"$class":"org.accordproject.commonmark@0.5.0.List","type":"bullet","tight":"true"} as CiceroMark.IListBlock;
      Runtime.peek($data).forEach( (item:any) => {
      Runtime.push($data,item);
         // start processing Item
            // Item 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Item"} as CommonMark.IItem;
            })();
            Runtime.addChild($nodes, $result);
            // Paragraph 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
            })();
            Runtime.addChild($nodes, $result);
            // VariableDefinition (this)
            Runtime.push($nodes, $result);
            $result = (() => {
            const text = JSON.stringify(Runtime.peek($data)) as string;
            const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"this"};
            variable.value = text;
            return variable as CiceroMark.IVariable;
            })();
            Runtime.addChild($nodes, $result);
            $result = Runtime.pop($nodes);
            $result = Runtime.pop($nodes);
            $result = Runtime.pop($nodes);
         // end processing Item
      Runtime.pop($data);
      });
      return result;
      })();
      Runtime.addChild($nodes, $result);
      Runtime.pop($data);
      $result = Runtime.pop($nodes);
      // Heading 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Heading","level":"2"} as CommonMark.IHeading;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Address","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // ClauseDefinition (address)
      Runtime.push($nodes, $result);
      Runtime.push($data, Runtime.peekProperty($data, 'address', false));
      $result = (() => {
      const isTrue:boolean = true;
      if(isTrue) {
      return {"$class":"org.accordproject.ciceromark@0.6.0.Clause","name":"address"} as CiceroMark.IClause;
      }
      else {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      }
      })();
      Runtime.addChild($nodes, $result);
      // List 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.List","type":"bullet","tight":"true"} as CommonMark.IList;
      })();
      Runtime.addChild($nodes, $result);
      // Item 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Item"} as CommonMark.IItem;
      })();
      Runtime.addChild($nodes, $result);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Street: ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // VariableDefinition (street)
      Runtime.push($nodes, $result);
      $result = (() => {
      Runtime.push($data, Runtime.peekProperty($data, 'street', false));
      const text = JSON.stringify(Runtime.peek($data)) as string;
      Runtime.pop($data);
      const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"street"};
      variable.value = text;
      return variable as CiceroMark.IVariable;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Item 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Item"} as CommonMark.IItem;
      })();
      Runtime.addChild($nodes, $result);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"City: ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // VariableDefinition (city)
      Runtime.push($nodes, $result);
      $result = (() => {
      Runtime.push($data, Runtime.peekProperty($data, 'city', false));
      const text = JSON.stringify(Runtime.peek($data)) as string;
      Runtime.pop($data);
      const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"city"};
      variable.value = text;
      return variable as CiceroMark.IVariable;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Item 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Item"} as CommonMark.IItem;
      })();
      Runtime.addChild($nodes, $result);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"ZIP: ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // VariableDefinition (zip)
      Runtime.push($nodes, $result);
      $result = (() => {
      Runtime.push($data, Runtime.peekProperty($data, 'zip', false));
      const text = JSON.stringify(Runtime.peek($data)) as string;
      Runtime.pop($data);
      const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"zip"};
      variable.value = text;
      return variable as CiceroMark.IVariable;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      Runtime.pop($data);
      $result = Runtime.pop($nodes);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Your city is: ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // WithDefinition (address)
      Runtime.push($data, Runtime.peekProperty($data, 'address', false));
      // Emph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Emph"} as CommonMark.IEmph;
      })();
      Runtime.addChild($nodes, $result);
      // Strong 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Strong"} as CommonMark.IStrong;
      })();
      Runtime.addChild($nodes, $result);
      // VariableDefinition (city)
      Runtime.push($nodes, $result);
      $result = (() => {
      Runtime.push($data, Runtime.peekProperty($data, 'city', false));
      const text = JSON.stringify(Runtime.peek($data)) as string;
      Runtime.pop($data);
      const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"city"};
      variable.value = text;
      return variable as CiceroMark.IVariable;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":".","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      Runtime.pop($data);
      $result = Runtime.pop($nodes);
      // Heading 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Heading","level":"2"} as CommonMark.IHeading;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Account Status","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // ConditionalDefinition (active)
      Runtime.push($nodes, $result);
      $result = (() => {
      Runtime.push($data, Runtime.peekProperty($data, 'active', false));
      const isTrue:boolean = Runtime.peek($data);
      Runtime.pop($data);
      const curNode = {"$class":"org.accordproject.ciceromark@0.6.0.Conditional","whenTrue":[{"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Your account is active."}],"whenFalse":[{"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Your account has been deactivated."}],"name":"active","isTrue":true} as CiceroMark.IConditional;
      (curNode as CiceroMark.IConditional).isTrue = isTrue;
      return curNode;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // BlockQuote 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.BlockQuote"} as CommonMark.IBlockQuote;
      })();
      Runtime.addChild($nodes, $result);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Thank you for visiting us ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // Strong 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Strong"} as CommonMark.IStrong;
      })();
      Runtime.addChild($nodes, $result);
      // FormulaDefinition (formula_53113a901ca88208df47bc83374866e8d497d84099c0f88123c918ff1960b17e)
      Runtime.push($nodes, $result);
      $result = (() => {
      const formulaResult = UserCode.formula_53113a901ca88208df47bc83374866e8d497d84099c0f88123c918ff1960b17e(data,library,now);
      const text = JSON.stringify(formulaResult);
      const formula:any = {"$class":"org.accordproject.ciceromark@0.6.0.Formula","dependencies":[],"code":{"$class":"org.accordproject.templatemark@0.4.0.Code","type":"ES_2020","contents":" return now.diff(lastVisit,'day') "},"name":"formula_53113a901ca88208df47bc83374866e8d497d84099c0f88123c918ff1960b17e"};
      formula.value = text;
      formula.code = " return now.diff(lastVisit,'day') ";
      return formula as CiceroMark.IFormula;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":" days ago.","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // Linebreak 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Linebreak"} as CommonMark.ILinebreak;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Your last visit was: ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // FormattedVariableDefinition (lastVisit)
      Runtime.push($nodes, $result);
      $result = (() => {
      Runtime.push($data, Runtime.peekProperty($data, 'lastVisit', false));
      const drafter = $getDrafter('DateTime');
      const text = drafter ? drafter(Runtime.peek($data), 'MM/DD/YYYY') : JSON.stringify(Runtime.peek($data)) as string;
      Runtime.pop($data);
      const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.FormattedVariable","format":"MM/DD/YYYY","name":"lastVisit"};
      variable.value = text;
      return variable as CiceroMark.IFormattedVariable;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":".","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // FormulaDefinition (formula_7841bd178366af21ea233d10968eaf538d12fb7a50cbaf9cbe1b51a00cb0f6a8)
      Runtime.push($nodes, $result);
      $result = (() => {
      const formulaResult = UserCode.formula_7841bd178366af21ea233d10968eaf538d12fb7a50cbaf9cbe1b51a00cb0f6a8(data,library,now);
      const text = JSON.stringify(formulaResult);
      const formula:any = {"$class":"org.accordproject.ciceromark@0.6.0.Formula","dependencies":[],"code":{"$class":"org.accordproject.templatemark@0.4.0.Code","type":"ES_2020","contents":"\n// test we can use typescript!\nconst addressBook:Map<string,string> = new Map<string,string>();\naddressBook.set('123', 'Dan Selman');\naddressBook.set('234', 'Isaac Selman');\naddressBook.set('456', 'Tenzin Selman');\naddressBook.set('789', 'Mi-a Selman');\nlet result = '';\naddressBook.forEach((value, key) => {\n   result += `[${key} : ${value}]`;\n});\nreturn result;\n"},"name":"formula_7841bd178366af21ea233d10968eaf538d12fb7a50cbaf9cbe1b51a00cb0f6a8"};
      formula.value = text;
      formula.code = "\n// test we can use typescript!\nconst addressBook:Map<string,string> = new Map<string,string>();\naddressBook.set('123', 'Dan Selman');\naddressBook.set('234', 'Isaac Selman');\naddressBook.set('456', 'Tenzin Selman');\naddressBook.set('789', 'Mi-a Selman');\nlet result = '';\naddressBook.forEach((value, key) => {\n   result += `[${key} : ${value}]`;\n});\nreturn result;\n";
      return formula as CiceroMark.IFormula;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Heading 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Heading","level":"2"} as CommonMark.IHeading;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Orders","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // ListBlockDefinition (orders)
      Runtime.push($nodes, $result);
      Runtime.push($data, Runtime.peekProperty($data, 'orders', false));
      $result = (() => {
      const result = {"$class":"org.accordproject.commonmark@0.5.0.List","type":"bullet","tight":"true"} as CiceroMark.IListBlock;
      Runtime.peek($data).forEach( (item:any) => {
      Runtime.push($data,item);
         // start processing Item
            // Item 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Item"} as CommonMark.IItem;
            })();
            Runtime.addChild($nodes, $result);
            // Paragraph 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
            })();
            Runtime.addChild($nodes, $result);
            // Strong 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Strong"} as CommonMark.IStrong;
            })();
            Runtime.addChild($nodes, $result);
            // VariableDefinition (sku)
            Runtime.push($nodes, $result);
            $result = (() => {
            Runtime.push($data, Runtime.peekProperty($data, 'sku', false));
            const text = JSON.stringify(Runtime.peek($data)) as string;
            Runtime.pop($data);
            const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"sku"};
            variable.value = text;
            return variable as CiceroMark.IVariable;
            })();
            Runtime.addChild($nodes, $result);
            $result = Runtime.pop($nodes);
            $result = Runtime.pop($nodes);
            // Text 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":" : ","nodes":[]} as CommonMark.IText;
            })();
            Runtime.addChild($nodes, $result);
            $result = Runtime.pop($nodes);
            // Emph 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Emph"} as CommonMark.IEmph;
            })();
            Runtime.addChild($nodes, $result);
            // VariableDefinition (amount)
            Runtime.push($nodes, $result);
            $result = (() => {
            Runtime.push($data, Runtime.peekProperty($data, 'amount', false));
            const text = JSON.stringify(Runtime.peek($data)) as string;
            Runtime.pop($data);
            const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"amount"};
            variable.value = text;
            return variable as CiceroMark.IVariable;
            })();
            Runtime.addChild($nodes, $result);
            $result = Runtime.pop($nodes);
            $result = Runtime.pop($nodes);
            $result = Runtime.pop($nodes);
            $result = Runtime.pop($nodes);
         // end processing Item
      Runtime.pop($data);
      });
      return result;
      })();
      Runtime.addChild($nodes, $result);
      Runtime.pop($data);
      $result = Runtime.pop($nodes);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // OptionalDefinition (loyaltyStatus)
      Runtime.push($nodes, $result);
      Runtime.push($data, Runtime.peekProperty($data, 'loyaltyStatus', true));
      $result = (() => {
      const result = {"$class":"org.accordproject.ciceromark@0.6.0.Optional","name":"loyaltyStatus"} as CiceroMark.IOptional;
      const hasSome:boolean = !(Runtime.peek($data) === null || Runtime.peek($data) === undefined);
      (result as CiceroMark.IOptional).hasSome = hasSome;
      if(hasSome) {
         // start processing Paragraph
            // Paragraph 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
            })();
            Runtime.addChild($nodes, $result);
            // Text 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Your loyalty status: ","nodes":[]} as CommonMark.IText;
            })();
            Runtime.addChild($nodes, $result);
            $result = Runtime.pop($nodes);
            // VariableDefinition (level)
            Runtime.push($nodes, $result);
            $result = (() => {
            Runtime.push($data, Runtime.peekProperty($data, 'level', false));
            const text = JSON.stringify(Runtime.peek($data)) as string;
            Runtime.pop($data);
            const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"level"};
            variable.value = text;
            return variable as CiceroMark.IVariable;
            })();
            Runtime.addChild($nodes, $result);
            $result = Runtime.pop($nodes);
            $result = Runtime.pop($nodes);
         // end processing Paragraph
      (result as CiceroMark.IOptional).whenSome = $result.nodes[0];
      (result as CiceroMark.IOptional).whenNone = $result.nodes[0];
      return result;
      }
      else {
         // start processing Paragraph
            // Paragraph 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
            })();
            Runtime.addChild($nodes, $result);
            // Text 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"You do not have a loyalty status.","nodes":[]} as CommonMark.IText;
            })();
            Runtime.addChild($nodes, $result);
            $result = Runtime.pop($nodes);
            $result = Runtime.pop($nodes);
         // end processing Paragraph
      (result as CiceroMark.IOptional).whenNone = $result.nodes[0];
      (result as CiceroMark.IOptional).whenSome = $result.nodes[0];
      return result;
      }
      })();
      Runtime.addChild($nodes, $result);
      Runtime.pop($data);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // ClauseDefinition (preferences)
      Runtime.push($nodes, $result);
      Runtime.push($data, Runtime.peekProperty($data, 'preferences', false));
      $result = (() => {
      const isTrue:boolean = UserCode.condition_nodes_0_nodes_14(data,library,now)
      if(isTrue) {
      return {"$class":"org.accordproject.ciceromark@0.6.0.Clause","name":"preferences"} as CiceroMark.IClause;
      }
      else {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      }
      })();
      Runtime.addChild($nodes, $result);
      // Heading 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Heading","level":"2"} as CommonMark.IHeading;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Favorite Colors","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Your favorite colors are: ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // FormulaDefinition (formula_4b8f7e95470eda90057c4648aac4e4c7abb3f93559ed348246b6a15ec1fea473)
      Runtime.push($nodes, $result);
      $result = (() => {
      const formulaResult = UserCode.formula_4b8f7e95470eda90057c4648aac4e4c7abb3f93559ed348246b6a15ec1fea473(data,library,now);
      const text = JSON.stringify(formulaResult);
      const formula:any = {"$class":"org.accordproject.ciceromark@0.6.0.Formula","dependencies":[],"code":{"$class":"org.accordproject.templatemark@0.4.0.Code","type":"ES_2020","contents":" return preferences.favoriteColors !== undefined ? preferences.favoriteColors.join(' and ') : 'No favorite colors!' "},"name":"formula_4b8f7e95470eda90057c4648aac4e4c7abb3f93559ed348246b6a15ec1fea473"};
      formula.value = text;
      formula.code = " return preferences.favoriteColors !== undefined ? preferences.favoriteColors.join(' and ') : 'No favorite colors!' ";
      return formula as CiceroMark.IFormula;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // Image 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Image","destination":"https://www.litmus.com/wp-content/uploads/2021/02/motion-tween-example.gif","title":""} as CommonMark.IImage;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // ListBlockDefinition (favoriteColors)
      Runtime.push($nodes, $result);
      Runtime.push($data, Runtime.peekProperty($data, 'favoriteColors', false));
      $result = (() => {
      const result = {"$class":"org.accordproject.commonmark@0.5.0.List","type":"bullet","tight":"true"} as CiceroMark.IListBlock;
      Runtime.peek($data).forEach( (item:any) => {
      Runtime.push($data,item);
         // start processing Item
            // Item 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Item"} as CommonMark.IItem;
            })();
            Runtime.addChild($nodes, $result);
            // Paragraph 
            Runtime.push($nodes, $result);
            $result = (() => {
            return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
            })();
            Runtime.addChild($nodes, $result);
            // VariableDefinition (this)
            Runtime.push($nodes, $result);
            $result = (() => {
            const text = JSON.stringify(Runtime.peek($data)) as string;
            const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"this"};
            variable.value = text;
            return variable as CiceroMark.IVariable;
            })();
            Runtime.addChild($nodes, $result);
            $result = Runtime.pop($nodes);
            $result = Runtime.pop($nodes);
            $result = Runtime.pop($nodes);
         // end processing Item
      Runtime.pop($data);
      });
      return result;
      })();
      Runtime.addChild($nodes, $result);
      Runtime.pop($data);
      $result = Runtime.pop($nodes);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // ConditionalDefinition (favoriteColors)
      Runtime.push($nodes, $result);
      $result = (() => {
      const isTrue:boolean = UserCode.condition_nodes_0_nodes_14_nodes_4_nodes_0(data,library,now)
      const curNode = {"$class":"org.accordproject.ciceromark@0.6.0.Conditional","whenTrue":[{"$class":"org.accordproject.commonmark@0.5.0.Text","text":"You like pink!"}],"whenFalse":[{"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Why don't you like PINK!"}],"name":"favoriteColors","isTrue":true} as CiceroMark.IConditional;
      (curNode as CiceroMark.IConditional).isTrue = isTrue;
      return curNode;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      Runtime.pop($data);
      $result = Runtime.pop($nodes);
      // Heading 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Heading","level":"2"} as CommonMark.IHeading;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Dynamic Query of Clauses","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Heading 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Heading","level":"3"} as CommonMark.IHeading;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Onboarding Clauses","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // BlockQuote 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.BlockQuote"} as CommonMark.IBlockQuote;
      })();
      Runtime.addChild($nodes, $result);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // FormulaDefinition (formula_a8a1d7714d95baa82f730e0105d2f2d0a9fc25ee9b6055058cc09667c01c01ab)
      Runtime.push($nodes, $result);
      $result = (() => {
      const formulaResult = UserCode.formula_a8a1d7714d95baa82f730e0105d2f2d0a9fc25ee9b6055058cc09667c01c01ab(data,library,now);
      const text = JSON.stringify(formulaResult);
      const formula:any = {"$class":"org.accordproject.ciceromark@0.6.0.Formula","dependencies":[],"code":{"$class":"org.accordproject.templatemark@0.4.0.Code","type":"ES_2020","contents":" \n    return jp.query(library, `$.clauses[?(@.category==\"onboarding\")]`);\n"},"name":"formula_a8a1d7714d95baa82f730e0105d2f2d0a9fc25ee9b6055058cc09667c01c01ab"};
      formula.value = text;
      formula.code = " \n    return jp.query(library, `$.clauses[?(@.category==\"onboarding\")]`);\n";
      return formula as CiceroMark.IFormula;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Heading 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Heading","level":"3"} as CommonMark.IHeading;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Authored by ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // VariableDefinition (firstName)
      Runtime.push($nodes, $result);
      $result = (() => {
      Runtime.push($data, Runtime.peekProperty($data, 'firstName', false));
      const text = JSON.stringify(Runtime.peek($data)) as string;
      Runtime.pop($data);
      const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"firstName"};
      variable.value = text;
      return variable as CiceroMark.IVariable;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // BlockQuote 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.BlockQuote"} as CommonMark.IBlockQuote;
      })();
      Runtime.addChild($nodes, $result);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // FormulaDefinition (formula_daca9cb2f5bc16b65f544e6f408c1e3121d50a3251ec4fbe2f27132818acc3d2)
      Runtime.push($nodes, $result);
      $result = (() => {
      const formulaResult = UserCode.formula_daca9cb2f5bc16b65f544e6f408c1e3121d50a3251ec4fbe2f27132818acc3d2(data,library,now);
      const text = JSON.stringify(formulaResult);
      const formula:any = {"$class":"org.accordproject.ciceromark@0.6.0.Formula","dependencies":[],"code":{"$class":"org.accordproject.templatemark@0.4.0.Code","type":"ES_2020","contents":" \n    return jp.query(library, `$.clauses[?(@.author==\"${firstName}\")]`);\n"},"name":"formula_daca9cb2f5bc16b65f544e6f408c1e3121d50a3251ec4fbe2f27132818acc3d2"};
      formula.value = text;
      formula.code = " \n    return jp.query(library, `$.clauses[?(@.author==\"${firstName}\")]`);\n";
      return formula as CiceroMark.IFormula;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Heading 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Heading","level":"3"} as CommonMark.IHeading;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"High Risk","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // BlockQuote 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.BlockQuote"} as CommonMark.IBlockQuote;
      })();
      Runtime.addChild($nodes, $result);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // FormulaDefinition (formula_4c874b2977b5eef204e4987efc0a5594c7cce66403e54c17daa1e1c721d755a0)
      Runtime.push($nodes, $result);
      $result = (() => {
      const formulaResult = UserCode.formula_4c874b2977b5eef204e4987efc0a5594c7cce66403e54c17daa1e1c721d755a0(data,library,now);
      const text = JSON.stringify(formulaResult);
      const formula:any = {"$class":"org.accordproject.ciceromark@0.6.0.Formula","dependencies":[],"code":{"$class":"org.accordproject.templatemark@0.4.0.Code","type":"ES_2020","contents":" \n    return jp.query(library, `$.clauses[?(@.risk>4)]`);\n"},"name":"formula_4c874b2977b5eef204e4987efc0a5594c7cce66403e54c17daa1e1c721d755a0"};
      formula.value = text;
      formula.code = " \n    return jp.query(library, `$.clauses[?(@.risk>4)]`);\n";
      return formula as CiceroMark.IFormula;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Heading 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Heading","level":"3"} as CommonMark.IHeading;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Low Risk and authored by ","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      // VariableDefinition (firstName)
      Runtime.push($nodes, $result);
      $result = (() => {
      Runtime.push($data, Runtime.peekProperty($data, 'firstName', false));
      const text = JSON.stringify(Runtime.peek($data)) as string;
      Runtime.pop($data);
      const variable:any = {"$class":"org.accordproject.ciceromark@0.6.0.Variable","name":"firstName"};
      variable.value = text;
      return variable as CiceroMark.IVariable;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // BlockQuote 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.BlockQuote"} as CommonMark.IBlockQuote;
      })();
      Runtime.addChild($nodes, $result);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // FormulaDefinition (formula_646a6cadec2125e4fd9e4b756aac72bc618b528967f04d325b28a817774441dd)
      Runtime.push($nodes, $result);
      $result = (() => {
      const formulaResult = UserCode.formula_646a6cadec2125e4fd9e4b756aac72bc618b528967f04d325b28a817774441dd(data,library,now);
      const text = JSON.stringify(formulaResult);
      const formula:any = {"$class":"org.accordproject.ciceromark@0.6.0.Formula","dependencies":[],"code":{"$class":"org.accordproject.templatemark@0.4.0.Code","type":"ES_2020","contents":" \n    return jp.query(library, `$.clauses[?(@.risk<3 && @.author==\"${firstName}\")]`);\n"},"name":"formula_646a6cadec2125e4fd9e4b756aac72bc618b528967f04d325b28a817774441dd"};
      formula.value = text;
      formula.code = " \n    return jp.query(library, `$.clauses[?(@.risk<3 && @.author==\"${firstName}\")]`);\n";
      return formula as CiceroMark.IFormula;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      // Paragraph 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Paragraph"} as CommonMark.IParagraph;
      })();
      Runtime.addChild($nodes, $result);
      // Text 
      Runtime.push($nodes, $result);
      $result = (() => {
      return {"$class":"org.accordproject.commonmark@0.5.0.Text","text":"Done.","nodes":[]} as CommonMark.IText;
      })();
      Runtime.addChild($nodes, $result);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
      $result = Runtime.pop($nodes);
   // end processing Document
return $result as CommonMark.IDocument;
}
