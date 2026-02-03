/**
 * Coverage helpers and utilities for ensuring test coverage meets thresholds
 * Provides tools for coverage analysis and reporting
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CoverageThresholds {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

export interface CoverageReport {
  total: CoverageThresholds;
  files: Record<string, CoverageThresholds>;
}

export interface TestCoverageConfig {
  thresholds: {
    global: CoverageThresholds;
    perFile?: CoverageThresholds;
  };
  excludePatterns: string[];
  includePatterns: string[];
}

/**
 * Default coverage configuration
 */
export const DEFAULT_COVERAGE_CONFIG: TestCoverageConfig = {
  thresholds: {
    global: {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
    perFile: {
      lines: 70,
      functions: 70,
      branches: 60,
      statements: 70,
    },
  },
  excludePatterns: [
    '**/*.module.ts',
    '**/dto/**',
    '**/migrations/**',
    '**/main.ts',
    '**/*.spec.ts',
    '**/*.e2e-spec.ts',
    '**/*.integration-spec.ts',
    '**/test/**',
    '**/coverage/**',
    '**/node_modules/**',
  ],
  includePatterns: ['src/**/*.ts'],
};

/**
 * Coverage analyzer for checking coverage metrics
 */
export class CoverageAnalyzer {
  private config: TestCoverageConfig;

  constructor(config: TestCoverageConfig = DEFAULT_COVERAGE_CONFIG) {
    this.config = config;
  }

  /**
   * Check if coverage meets minimum thresholds
   */
  checkThresholds(report: CoverageReport): {
    passed: boolean;
    failures: string[];
    summary: any;
  } {
    const failures: string[] = [];
    const { global } = this.config.thresholds;

    // Check global thresholds
    if (report.total.lines < global.lines) {
      failures.push(
        `Global line coverage ${report.total.lines}% is below threshold ${global.lines}%`,
      );
    }

    if (report.total.functions < global.functions) {
      failures.push(
        `Global function coverage ${report.total.functions}% is below threshold ${global.functions}%`,
      );
    }

    if (report.total.branches < global.branches) {
      failures.push(
        `Global branch coverage ${report.total.branches}% is below threshold ${global.branches}%`,
      );
    }

    if (report.total.statements < global.statements) {
      failures.push(
        `Global statement coverage ${report.total.statements}% is below threshold ${global.statements}%`,
      );
    }

    // Check per-file thresholds if configured
    if (this.config.thresholds.perFile) {
      const perFile = this.config.thresholds.perFile;
      Object.entries(report.files).forEach(([file, coverage]) => {
        if (coverage.lines < perFile.lines) {
          failures.push(
            `File ${file} line coverage ${coverage.lines}% is below threshold ${perFile.lines}%`,
          );
        }
        if (coverage.functions < perFile.functions) {
          failures.push(
            `File ${file} function coverage ${coverage.functions}% is below threshold ${perFile.functions}%`,
          );
        }
      });
    }

    return {
      passed: failures.length === 0,
      failures,
      summary: {
        global: report.total,
        thresholds: global,
        fileCount: Object.keys(report.files).length,
      },
    };
  }

  /**
   * Generate coverage report summary
   */
  generateSummary(report: CoverageReport): string {
    const { total } = report;
    const fileCount = Object.keys(report.files).length;

    const summary = `
Coverage Summary:
================
Files: ${fileCount}
Lines: ${total.lines.toFixed(2)}%
Functions: ${total.functions.toFixed(2)}%
Branches: ${total.branches.toFixed(2)}%
Statements: ${total.statements.toFixed(2)}%

Thresholds:
Lines: ${this.config.thresholds.global.lines}%
Functions: ${this.config.thresholds.global.functions}%
Branches: ${this.config.thresholds.global.branches}%
Statements: ${this.config.thresholds.global.statements}%
`;

    return summary;
  }

  /**
   * Identify files with low coverage
   */
  identifyLowCoverageFiles(report: CoverageReport, threshold: number = 70): string[] {
    return Object.entries(report.files)
      .filter(([_, coverage]) => coverage.lines < threshold)
      .map(([file, _]) => file)
      .sort();
  }

  /**
   * Get coverage improvement suggestions
   */
  getSuggestions(report: CoverageReport): string[] {
    const suggestions: string[] = [];
    const { total } = report;
    const { global } = this.config.thresholds;

    if (total.functions < global.functions) {
      suggestions.push('Add unit tests for uncovered functions');
    }

    if (total.branches < global.branches) {
      suggestions.push('Add tests for conditional logic and error paths');
      suggestions.push('Test edge cases and boundary conditions');
    }

    if (total.lines < global.lines) {
      suggestions.push('Add tests for uncovered code paths');
      suggestions.push('Consider removing dead code');
    }

    const lowCoverageFiles = this.identifyLowCoverageFiles(report);
    if (lowCoverageFiles.length > 0) {
      suggestions.push(
        `Focus on improving coverage for: ${lowCoverageFiles.slice(0, 5).join(', ')}`,
      );
    }

    return suggestions;
  }
}

/**
 * Test completeness checker
 */
export class TestCompletenessChecker {
  /**
   * Check if all service files have corresponding test files
   */
  checkServiceTestCoverage(
    srcDir: string,
    testDir: string,
  ): {
    missing: string[];
    existing: string[];
    coverage: number;
  } {
    const serviceFiles = this.findServiceFiles(srcDir);
    const testFiles = this.findTestFiles(testDir);

    const missing: string[] = [];
    const existing: string[] = [];

    serviceFiles.forEach((serviceFile) => {
      const testFileName = this.getTestFileName(serviceFile);
      const hasTest = testFiles.some((testFile) => testFile.includes(testFileName));

      if (hasTest) {
        existing.push(serviceFile);
      } else {
        missing.push(serviceFile);
      }
    });

    const coverage = (existing.length / serviceFiles.length) * 100;

    return {
      missing,
      existing,
      coverage,
    };
  }

  /**
   * Check if all controller files have corresponding test files
   */
  checkControllerTestCoverage(
    srcDir: string,
    testDir: string,
  ): {
    missing: string[];
    existing: string[];
    coverage: number;
  } {
    const controllerFiles = this.findControllerFiles(srcDir);
    const testFiles = this.findTestFiles(testDir);

    const missing: string[] = [];
    const existing: string[] = [];

    controllerFiles.forEach((controllerFile) => {
      const testFileName = this.getTestFileName(controllerFile);
      const hasTest = testFiles.some((testFile) => testFile.includes(testFileName));

      if (hasTest) {
        existing.push(controllerFile);
      } else {
        missing.push(controllerFile);
      }
    });

    const coverage = (existing.length / controllerFiles.length) * 100;

    return {
      missing,
      existing,
      coverage,
    };
  }

  private findServiceFiles(dir: string): string[] {
    return this.findFiles(dir, /\.service\.ts$/);
  }

  private findControllerFiles(dir: string): string[] {
    return this.findFiles(dir, /\.controller\.ts$/);
  }

  private findTestFiles(dir: string): string[] {
    return this.findFiles(dir, /\.spec\.ts$/);
  }

  private findFiles(dir: string, pattern: RegExp): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const scan = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir);

      entries.forEach((entry) => {
        const fullPath = path.join(currentDir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (pattern.test(entry)) {
          files.push(fullPath);
        }
      });
    };

    scan(dir);
    return files;
  }

  private getTestFileName(filePath: string): string {
    const basename = path.basename(filePath, '.ts');
    return `${basename}.spec.ts`;
  }
}

/**
 * Coverage reporter for generating detailed reports
 */
export class CoverageReporter {
  /**
   * Generate HTML coverage report
   */
  generateHtmlReport(report: CoverageReport): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .metric { display: inline-block; margin: 10px 15px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; }
        .high { color: #28a745; }
        .medium { color: #ffc107; }
        .low { color: #dc3545; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .progress-bar { width: 100px; height: 20px; background-color: #f0f0f0; border-radius: 3px; overflow: hidden; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
    </style>
</head>
<body>
    <h1>Test Coverage Report</h1>

    <div class="summary">
        <h2>Overall Coverage</h2>
        <div class="metric">
            <div class="metric-value ${this.getCoverageClass(report.total.lines)}">${report.total.lines.toFixed(1)}%</div>
            <div>Lines</div>
        </div>
        <div class="metric">
            <div class="metric-value ${this.getCoverageClass(report.total.functions)}">${report.total.functions.toFixed(1)}%</div>
            <div>Functions</div>
        </div>
        <div class="metric">
            <div class="metric-value ${this.getCoverageClass(report.total.branches)}">${report.total.branches.toFixed(1)}%</div>
            <div>Branches</div>
        </div>
        <div class="metric">
            <div class="metric-value ${this.getCoverageClass(report.total.statements)}">${report.total.statements.toFixed(1)}%</div>
            <div>Statements</div>
        </div>
    </div>

    <h2>File Coverage Details</h2>
    <table>
        <thead>
            <tr>
                <th>File</th>
                <th>Lines</th>
                <th>Functions</th>
                <th>Branches</th>
                <th>Statements</th>
            </tr>
        </thead>
        <tbody>
            ${Object.entries(report.files)
              .map(
                ([file, coverage]) => `
                <tr>
                    <td>${file}</td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress-fill ${this.getCoverageClass(coverage.lines)}"
                                 style="width: ${coverage.lines}%; background-color: ${this.getCoverageColor(coverage.lines)};"></div>
                        </div>
                        ${coverage.lines.toFixed(1)}%
                    </td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress-fill ${this.getCoverageClass(coverage.functions)}"
                                 style="width: ${coverage.functions}%; background-color: ${this.getCoverageColor(coverage.functions)};"></div>
                        </div>
                        ${coverage.functions.toFixed(1)}%
                    </td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress-fill ${this.getCoverageClass(coverage.branches)}"
                                 style="width: ${coverage.branches}%; background-color: ${this.getCoverageColor(coverage.branches)};"></div>
                        </div>
                        ${coverage.branches.toFixed(1)}%
                    </td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress-fill ${this.getCoverageClass(coverage.statements)}"
                                 style="width: ${coverage.statements}%; background-color: ${this.getCoverageColor(coverage.statements)};"></div>
                        </div>
                        ${coverage.statements.toFixed(1)}%
                    </td>
                </tr>
            `,
              )
              .join('')}
        </tbody>
    </table>
</body>
</html>`;

    return html;
  }

  /**
   * Generate JSON coverage report
   */
  generateJsonReport(report: CoverageReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate markdown coverage report
   */
  generateMarkdownReport(report: CoverageReport): string {
    const markdown = `
# Test Coverage Report

## Overall Coverage

| Metric | Coverage | Status |
|--------|----------|--------|
| Lines | ${report.total.lines.toFixed(1)}% | ${this.getCoverageEmoji(report.total.lines)} |
| Functions | ${report.total.functions.toFixed(1)}% | ${this.getCoverageEmoji(report.total.functions)} |
| Branches | ${report.total.branches.toFixed(1)}% | ${this.getCoverageEmoji(report.total.branches)} |
| Statements | ${report.total.statements.toFixed(1)}% | ${this.getCoverageEmoji(report.total.statements)} |

## File Coverage Details

| File | Lines | Functions | Branches | Statements |
|------|-------|-----------|----------|------------|
${Object.entries(report.files)
  .map(
    ([file, coverage]) =>
      `| ${file} | ${coverage.lines.toFixed(1)}% | ${coverage.functions.toFixed(1)}% | ${coverage.branches.toFixed(1)}% | ${coverage.statements.toFixed(1)}% |`,
  )
  .join('\n')}

Generated on: ${new Date().toISOString()}
`;

    return markdown;
  }

  private getCoverageClass(percentage: number): string {
    if (percentage >= 80) return 'high';
    if (percentage >= 60) return 'medium';
    return 'low';
  }

  private getCoverageColor(percentage: number): string {
    if (percentage >= 80) return '#28a745';
    if (percentage >= 60) return '#ffc107';
    return '#dc3545';
  }

  private getCoverageEmoji(percentage: number): string {
    if (percentage >= 80) return '✅';
    if (percentage >= 60) return '⚠️';
    return '❌';
  }
}

/**
 * Coverage utilities for test automation
 */
export class CoverageUtils {
  /**
   * Parse Istanbul coverage report
   */
  static parseIstanbulReport(coverageDir: string): CoverageReport | null {
    const reportPath = path.join(coverageDir, 'coverage-final.json');

    if (!fs.existsSync(reportPath)) {
      return null;
    }

    try {
      const rawData = fs.readFileSync(reportPath, 'utf8');
      const istanbulData = JSON.parse(rawData);

      return this.convertIstanbulToCoverageReport(istanbulData);
    } catch (error) {
      console.error('Failed to parse Istanbul coverage report:', error);
      return null;
    }
  }

  /**
   * Convert Istanbul format to our coverage report format
   */
  private static convertIstanbulToCoverageReport(istanbulData: any): CoverageReport {
    const files: Record<string, CoverageThresholds> = {};
    let totalLines = 0,
      coveredLines = 0;
    let totalFunctions = 0,
      coveredFunctions = 0;
    const totalBranches = 0,
      coveredBranches = 0;
    let totalStatements = 0,
      coveredStatements = 0;

    Object.entries(istanbulData).forEach(([filePath, fileData]: [string, any]) => {
      const lines = this.calculateCoverage(fileData.l || {});
      const functions = this.calculateCoverage(fileData.f || {});
      const branches = this.calculateCoverage(fileData.b || {});
      const statements = this.calculateCoverage(fileData.s || {});

      files[filePath] = { lines, functions, branches, statements };

      // Accumulate totals
      const lineData = fileData.l || {};
      const functionData = fileData.f || {};
      const branchData = fileData.b || {};
      const statementData = fileData.s || {};

      totalLines += Object.keys(lineData).length;
      coveredLines += Object.values(lineData).filter((count: any) => count > 0).length;

      totalFunctions += Object.keys(functionData).length;
      coveredFunctions += Object.values(functionData).filter((count: any) => count > 0).length;

      totalStatements += Object.keys(statementData).length;
      coveredStatements += Object.values(statementData).filter((count: any) => count > 0).length;
    });

    return {
      total: {
        lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
        functions: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
        branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
        statements: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
      },
      files,
    };
  }

  /**
   * Calculate coverage percentage for a metric
   */
  private static calculateCoverage(data: Record<string, number>): number {
    const total = Object.keys(data).length;
    if (total === 0) return 0;

    const covered = Object.values(data).filter((count) => count > 0).length;
    return (covered / total) * 100;
  }

  /**
   * Generate coverage badge data
   */
  static generateBadgeData(coverage: number): {
    label: string;
    message: string;
    color: string;
  } {
    let color = 'red';
    if (coverage >= 80) color = 'brightgreen';
    else if (coverage >= 70) color = 'yellow';
    else if (coverage >= 60) color = 'orange';

    return {
      label: 'coverage',
      message: `${coverage.toFixed(1)}%`,
      color,
    };
  }

  /**
   * Check if coverage meets minimum requirements
   */
  static meetsRequirements(report: CoverageReport, requirements: CoverageThresholds): boolean {
    return (
      report.total.lines >= requirements.lines &&
      report.total.functions >= requirements.functions &&
      report.total.branches >= requirements.branches &&
      report.total.statements >= requirements.statements
    );
  }
}
