export function formatContext(
  questions: string[],
  answers: string,
  followUp?: string | null,
  followUpAnswer?: string,
): string {
  const lines: string[] = [
    '## User context (personalise the roadmap to match this)',
    '',
    'Questions asked:',
    ...questions.map((q, i) => `${i + 1}. ${q}`),
    '',
    "User's answers:",
    answers,
  ]

  if (followUp && followUpAnswer) {
    lines.push('', 'Follow-up question:', followUp, '', "User's follow-up answer:", followUpAnswer)
  }

  return lines.join('\n')
}
