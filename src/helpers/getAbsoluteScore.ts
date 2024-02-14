export function getAbsoluteScore(absoluteScore: number): string {
  const parts = String(absoluteScore).split('.'); // Разделяем число на целую и десятичную части

  const integerPart = parts[0];

  const decimalPart = parts[1];

  if (decimalPart) {
    return `${integerPart}.${decimalPart[0]}`;
  }

  return absoluteScore.toFixed(1).toString();
}
