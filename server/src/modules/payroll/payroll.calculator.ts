import Decimal from 'decimal.js';

/**
 * Vietnamese Payroll Calculator — Pure function, no side effects
 * Based on:
 * - Luật BHXH 2014, sửa đổi 2024
 * - Luật Thuế TNCN, Thông tư 111/2013/TT-BTC
 * - Nghị định 24/2023/NĐ-CP (lương tối thiểu vùng)
 */

export interface EmployeeInput {
  base_salary: number;
  meal_allowance: number;
  phone_allowance: number;
  fuel_allowance: number;
  dependents: number;
  employment_status: 'ACTIVE' | 'PROBATION' | 'INACTIVE';
}

export interface PayrollConfigInput {
  base_salary_cap: number;      // 36,000,000 (20x lương cơ sở)
  personal_deduction: number;   // 11,000,000
  dependent_deduction: number;  // 4,400,000
  bhxh_employee: number;        // 8 (%)
  bhxh_employer: number;        // 17.5 (%)
  bhyt_employee: number;        // 1.5 (%)
  bhyt_employer: number;        // 3 (%)
  bhtn_employee: number;        // 1 (%)
  bhtn_employer: number;        // 1 (%)
  meal_cap: number;             // 730,000
  phone_cap: number;            // 1,000,000
  fuel_cap: number;             // 2,000,000
}

export interface PayrollBreakdown {
  // Gross
  gross_salary: number;

  // Insurance
  insurance_base: number;
  bhxh_employee: number;
  bhyt_employee: number;
  bhtn_employee: number;
  total_insurance_employee: number;
  bhxh_employer: number;
  bhyt_employer: number;
  bhtn_employer: number;
  total_insurance_employer: number;

  // Deductions
  tax_free_allowances: number;
  personal_deduction: number;
  dependent_deduction: number;
  taxable_income: number;

  // Tax
  pit: number;

  // Net
  net_salary: number;
}

// 7 bậc thuế TNCN lũy tiến
const PIT_BRACKETS = [
  { min: 0,        max: 5000000,   rate: 5 },
  { min: 5000000,  max: 10000000,  rate: 10 },
  { min: 10000000, max: 18000000,  rate: 15 },
  { min: 18000000, max: 32000000,  rate: 20 },
  { min: 32000000, max: 52000000,  rate: 25 },
  { min: 52000000, max: 80000000,  rate: 30 },
  { min: 80000000, max: Infinity,  rate: 35 },
];

function calculatePIT(taxableIncome: Decimal): Decimal {
  if (taxableIncome.lte(0)) return new Decimal(0);

  let tax = new Decimal(0);
  let remaining = taxableIncome;

  for (const bracket of PIT_BRACKETS) {
    if (remaining.lte(0)) break;
    const bracketSize = bracket.max === Infinity
      ? remaining
      : Decimal.min(remaining, new Decimal(bracket.max - bracket.min));
    tax = tax.plus(bracketSize.times(bracket.rate).div(100));
    remaining = remaining.minus(bracketSize);
  }

  return tax.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

export function calculatePayroll(employee: EmployeeInput, config: PayrollConfigInput): PayrollBreakdown {
  const base = new Decimal(employee.base_salary);
  const meal = new Decimal(employee.meal_allowance);
  const phone = new Decimal(employee.phone_allowance);
  const fuel = new Decimal(employee.fuel_allowance);

  // Gross = base + all allowances
  const gross = base.plus(meal).plus(phone).plus(fuel);

  // Probation: no insurance, no tax
  if (employee.employment_status === 'PROBATION') {
    return {
      gross_salary: gross.toNumber(),
      insurance_base: 0,
      bhxh_employee: 0, bhyt_employee: 0, bhtn_employee: 0, total_insurance_employee: 0,
      bhxh_employer: 0, bhyt_employer: 0, bhtn_employer: 0, total_insurance_employer: 0,
      tax_free_allowances: 0, personal_deduction: 0, dependent_deduction: 0,
      taxable_income: 0, pit: 0,
      net_salary: gross.toNumber(),
    };
  }

  // Insurance base = min(base_salary, cap) — only base salary, not allowances
  const insuranceBase = Decimal.min(base, new Decimal(config.base_salary_cap));

  // Employee insurance
  const bhxhEmp = insuranceBase.times(config.bhxh_employee).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const bhytEmp = insuranceBase.times(config.bhyt_employee).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const bhtnEmp = insuranceBase.times(config.bhtn_employee).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const totalInsEmp = bhxhEmp.plus(bhytEmp).plus(bhtnEmp);

  // Employer insurance
  const bhxhEr = insuranceBase.times(config.bhxh_employer).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const bhytEr = insuranceBase.times(config.bhyt_employer).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const bhtnEr = insuranceBase.times(config.bhtn_employer).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const totalInsEr = bhxhEr.plus(bhytEr).plus(bhtnEr);

  // Tax-free allowances (capped)
  const mealFree = Decimal.min(meal, new Decimal(config.meal_cap));
  const phoneFree = Decimal.min(phone, new Decimal(config.phone_cap));
  const fuelFree = Decimal.min(fuel, new Decimal(config.fuel_cap));
  const taxFreeAllowances = mealFree.plus(phoneFree).plus(fuelFree);

  // Personal + dependent deductions
  const personalDed = new Decimal(config.personal_deduction);
  const dependentDed = new Decimal(config.dependent_deduction).times(employee.dependents);

  // Taxable income = gross - tax_free_allowances - insurance_employee - personal - dependent
  const taxableIncome = Decimal.max(
    new Decimal(0),
    gross.minus(taxFreeAllowances).minus(totalInsEmp).minus(personalDed).minus(dependentDed)
  );

  // PIT
  const pit = calculatePIT(taxableIncome);

  // Net = gross - insurance_employee - pit
  const net = gross.minus(totalInsEmp).minus(pit);

  return {
    gross_salary: gross.toNumber(),
    insurance_base: insuranceBase.toNumber(),
    bhxh_employee: bhxhEmp.toNumber(),
    bhyt_employee: bhytEmp.toNumber(),
    bhtn_employee: bhtnEmp.toNumber(),
    total_insurance_employee: totalInsEmp.toNumber(),
    bhxh_employer: bhxhEr.toNumber(),
    bhyt_employer: bhytEr.toNumber(),
    bhtn_employer: bhtnEr.toNumber(),
    total_insurance_employer: totalInsEr.toNumber(),
    tax_free_allowances: taxFreeAllowances.toNumber(),
    personal_deduction: personalDed.toNumber(),
    dependent_deduction: dependentDed.toNumber(),
    taxable_income: taxableIncome.toNumber(),
    pit: pit.toNumber(),
    net_salary: net.toNumber(),
  };
}
