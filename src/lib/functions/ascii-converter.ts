export default function asciiConverter(str: string): string {
  return str
    .split('')
    .map((char) => char.charCodeAt(0))
    .join(' ');
}