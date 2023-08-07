import * as fs from 'fs';
import * as path from 'path';

export const public_key = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'auth.pub'),
);
export const private_key = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'auth.key'),
);

export const positionGroups = {
  'PhD Student': /\s(phd|doctoral|grad|graduate)+( candidate| student)/,
  Faculty:
    /prof|senior|pi|teacher|scholar|lec|advisor|inst|chair|scient|direc|invest/,
  'Postdoctoral Researcher': /^(research)|^(post)|(phd)/,
  'Research Assistant':
    /(research)[^\s]*( assistant| associate | coordinator) |(intern)|\bra/,
  'High School Student': /school/,
  Clinician: /(logist)|(clin)|(neuro)|(chief)|(cal)|\b(md)|(physic)/,
  'Undergraduate Student': /undergrad|\bteaching assistant/,
  'Masters Student': /masters|phil|mtech|msc/,
  Industry: /software|product|manager|owner|developer|des|engineer/,
  'Student (unspecified)': /student/,
};

export const emailConfirmSubject = 'Account Confirmation';
export const passwordResetSubject = 'Password reset instruction';

//TODO- is it better regex ?
// Added \b to the start and end of the expressions, which denotes word boundaries. This helps to ensure that we are matching whole words and not parts of words.
// Added i at the end of the expressions to make them case insensitive.

// export const positionGroups = {
//   "PhD Student": /\b(phd|doctoral|grad|graduate)( candidate| student)?\b/i,
//   "Faculty": /\b(prof|senior|pi|teacher|scholar|lecturer|advisor|instructor|chair|scientist|director|investigator)\b/i,
//   "Postdoctoral Researcher": /\b(postdoc|post-doctoral|research fellow|postgrad)\b/i,
//   "Research Assistant": /\b(research assistant|research associate|research coordinator|intern|ra)\b/i,
//   "High School Student": /\b(high school student)\b/i,
//   "Clinician": /\b(clinician|neurologist|chief|cardiologist|md|physician)\b/i,
//   "Undergraduate Student": /\b(undergrad|undergraduate|teaching assistant)\b/i,
//   "Masters Student": /\b(masters|philosophy|mtech|msc)\b/i,
//   "Industry": /\b(software|product manager|owner|developer|designer|engineer)\b/i,
//   "Student (unspecified)": /\b(student)\b/i,
// };
