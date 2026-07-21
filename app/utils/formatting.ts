const FRIEND_CODE_3DS_REGEX = /(\d{4})(?=\d)/g;
const FRIEND_CODE_SWITCH_REGEX = /(^[a-zA-Z]{2}|\d{4})(?=\d)/g;

export function capitalize (input: string): string {
  return input.replace(/([^\W_]+[^\s-]*) */g, (word) => word[0].toUpperCase() + word.substr(1).toLowerCase());
}

export function decimal (number: number, precision: number): string {
  return number.toFixed(precision);
}

export function friendCode3dsFormatter (code: string): string {
  return code.replace(FRIEND_CODE_3DS_REGEX, '$1-');
}

export function friendCodeSwitchFormatter (code: string): string {
  if (!code) {
    return code;
  }

  let upperCode = code.toUpperCase();

  ['S', 'W', '-'].forEach((letter, i) => {
    if (upperCode[i] && upperCode[i] !== letter) {
      upperCode = upperCode.slice(0, i) + letter + upperCode.slice(i);
    }
  });

  return upperCode.replace(FRIEND_CODE_SWITCH_REGEX, '$1-');
}

export function padding (number: number | '---', digits: number, value = '0'): string {
  if (parseInt(`${number}`, 10) >= 10 ** digits) {
    return `${number}`;
  }
  return `${value.repeat(digits)}${number}`.slice(-1 * digits);
}

export function nationalId (id: number): number {
  return id;
}

export function serebiiNationalId (id: number): number {
  id = nationalId(id);
  return id;
}

export function serebiiLink (serebiiPath: string, nationalId: number) {
  return `http://www.serebii.net/${serebiiPath}/${padding(serebiiNationalId(nationalId), 3)}.shtml`;
}
