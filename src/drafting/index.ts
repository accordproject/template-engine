/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import booleanDrafter from './Boolean';
import dateTimeDrafter from './DateTime';
import doubleDrafter from './Double';
import integerDrafter from './Integer';
import longDrafter from './Long';
import monetaryAmountDrafter from './MonetaryAmount';
import stringDrafter from './String';

export function getDrafter(typeName: string) : ((value:any, format:string) => string)|null  {
    switch(typeName) {
    case 'Boolean': return booleanDrafter;
    case 'DateTime': return dateTimeDrafter;
    case 'Double': return doubleDrafter;
    case 'Integer': return integerDrafter;
    case 'Long': return longDrafter;
    case 'org.accordproject.money@0.3.0.MonetaryAmount': return monetaryAmountDrafter;
    case 'String': return stringDrafter;
    default: return null;
    }
}