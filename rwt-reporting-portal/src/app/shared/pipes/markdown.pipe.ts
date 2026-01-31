import { Pipe, PipeTransform } from '@angular/core';
import { marked, MarkedOptions } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  private options: MarkedOptions = {
    breaks: true,
    gfm: true
  };

  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    // Debug: log the raw value to see if line breaks exist
    console.log('Markdown input:', JSON.stringify(value));

    const html = marked.parse(value, this.options) as string;

    // Debug: log the output HTML
    console.log('Markdown output:', html);

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
