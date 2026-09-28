export function padding (number: number, digits: number): string {
  return String(number).padStart(digits, '0');
}

export function serebiiLink (serebiiPath: string, nationalId: number) {
  return `http://www.serebii.net/${serebiiPath}/${padding(nationalId, 3)}.shtml`;
}
