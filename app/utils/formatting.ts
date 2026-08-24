export function decimal (number: number, precision: number): string {
  return number.toFixed(precision);
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
