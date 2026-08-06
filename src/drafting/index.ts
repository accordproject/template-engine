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

/* eslint-disable @typescript-eslint/no-explicit-any */

import booleanDrafter from './Boolean';
import dateTimeDrafter from './DateTime';
import doubleDrafter from './Double';
import integerDrafter from './Integer';
import durationDrafter from './Duration';
import longDrafter from './Long';
import monetaryAmountDrafter from './MonetaryAmount';
import preciseAmountDrafter from './PreciseAmount';
import { DraftFormat } from './DraftFormat';
import stringDrafter from './String';
import { ModelUtil } from '@accordproject/concerto-core';

function drafterKey(fqn: string): string {
    if (ModelUtil.isPrimitiveType(fqn)) {
        return fqn; // Boolean, String, Integer, ...
    }
    try {
        const ns = ModelUtil.getNamespace(fqn);
        const name = ModelUtil.getShortName(fqn);
        const { name: nsName, version } = ModelUtil.parseNamespace(ns);
        const major = version ? version.split('.')[0] : '';
        return `${nsName}@${major}.${name}`;
    } catch {
        // Not a versioned namespace type (e.g. user-defined concept without a version).
        // Return as-is so it hits the default: null branch in getDrafter.
        return fqn;
    }
}

export function getDrafter(typeName: string) : ((value:any, format?:DraftFormat) => string)|null  {
    switch(drafterKey(typeName)) {
    case 'Boolean': return booleanDrafter;
    case 'DateTime': return dateTimeDrafter;
    case 'Double': return doubleDrafter;
    case 'Integer': return integerDrafter;
    case 'Long': return longDrafter;
    case 'org.accordproject.money@0.MonetaryAmount': return monetaryAmountDrafter;
    case 'org.accordproject.money@1.PreciseAmount': return preciseAmountDrafter;
    case 'org.accordproject.time@0.Duration': return durationDrafter;
    case 'org.accordproject.time@0.Period': return durationDrafter;
    case 'String': return stringDrafter;
    default: return null;
    }
}
