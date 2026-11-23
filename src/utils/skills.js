// Kunnskaper/kompetanser som kan tildeles ansatte (admin velger i «Ny ansatt»/«Rediger ansatt»)
export const EMPLOYEE_SKILLS = ['Redningsmann', 'Førstehjelper', 'Heisoperatør', 'Instruktør'];

export const RESCUE_SKILL = 'Redningsmann';

export const hasSkill = (emp, skill) =>
  (emp?.skills || []).some(s => String(s).toLowerCase() === String(skill).toLowerCase());

export const isRescueWorker = (emp) => hasSkill(emp, RESCUE_SKILL);
