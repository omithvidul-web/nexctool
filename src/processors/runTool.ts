import type { ToolItem } from '../data/tools';
import type { ProcessOptions, ProcessResult } from './types';

export async function runToolProcessor(
  tool: ToolItem,
  files: File[],
  textInput: string,
  options: ProcessOptions
): Promise<ProcessResult> {
  if (tool.mode === 'coming-soon') {
    throw new Error('Server version coming soon. This format is not yet supported locally in browser.');
  }

  switch (tool.lazyGroup) {
    case 'image': {
      const { processImageTool } = await import('./imageProcessor');
      return processImageTool(tool.slug, files, options);
    }
    case 'pdf': {
      const { processPdfTool } = await import('./pdfProcessor');
      return processPdfTool(tool.slug, files, options);
    }
    case 'media': {
      const { processMediaTool } = await import('./mediaProcessor');
      return processMediaTool(tool.slug, files, options);
    }
    case 'spreadsheet': {
      const { processSpreadsheetTool } = await import('./spreadsheetProcessor');
      return processSpreadsheetTool(tool.slug, files, textInput);
    }
    case 'office': {
      const { processOfficeTool } = await import('./officeProcessor');
      return processOfficeTool(tool.slug, files, textInput, options);
    }
    case 'utility': {
      const { processUtilityTool } = await import('./utilityProcessor');
      return processUtilityTool(tool.slug, files, textInput, options);
    }
    case 'text':
    default: {
      const { processTextTool } = await import('./textProcessor');
      return processTextTool(tool.slug, files, textInput, options);
    }
  }
}
