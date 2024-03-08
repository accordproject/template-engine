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


const singleDigits = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
/**
 * Converts a number to its English text representation.
 * @param {number} value - The number to be converted to English text.
 * @returns {string} The English text representation of the input number.
 */ 
export function numberToText(value: number): string {
  return convertBillions(value);
}
function convertBillions(value: number): string {
  const M = 1000000000;
  if (value >= M) {
    let convertedMillions = convertMillions(value % M);
    convertedMillions = convertedMillions ? ` ${convertedMillions}` : "";
    return (
      convertBillions(Math.trunc(value / M)) + " billion" + convertedMillions
    );
  }
  return convertMillions(value);
}
function convertMillions(value: number): string {
  const M = 1000000;
  if (value >= M) {
    let convertedThousand = convertThousands(value % M);
    convertedThousand = convertedThousand ? ` ${convertedThousand}` : "";
    return (
      convertMillions(Math.trunc(value / M)) + " million" + convertedThousand
    );
  } else {
    return convertThousands(value);
  }
}

function convertThousands(value: number): string {
  if (value >= 1000) {
    let convertedHundred = convertHundred(value % 1000);
    convertedHundred = convertedHundred ? ` ${convertedHundred}` : "";
    return (
      convertHundred(Math.trunc(value / 1000)) + " thousand" + convertedHundred
    );
  } else {
    return convertHundred(value);
  }
}
function convertHundred(value: number): string {
  if (value >= 100) {
    let convertedTens = convertTens(value % 100);
    convertedTens = convertedTens ? ` ${convertedTens}` : "";
    return singleDigits[Math.trunc(value / 100)] + " hundred" + convertedTens;
  } else {
    return convertTens(value);
  }
}
function convertTens(value: number): string {
  if (value > 20) {
    return tens[Math.trunc(value / 10)] + " " + singleDigits[value % 10];
  } else if (value >= 10) {
    return teens[value - 10];
  } else {
    return singleDigits[value];
  }
}
