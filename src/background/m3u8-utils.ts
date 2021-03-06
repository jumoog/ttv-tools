import { DateRangeClass } from '../types';

export function lastDateRangeIdx(data: string) {
    return data.lastIndexOf('#EXT-X-DATERANGE');
}

export function lastDateRange(data: string): DateRangeClass {
    const idxData = lastDateRangeIdx(data);

    return data.substring(idxData).match(/CLASS="([\w-]+)"/)?.[1] as DateRangeClass;
}

export function firstDateRangeIdx(data: string) {
    return data.indexOf('#EXT-X-DATERANGE');
}

export function firstDateRange(data: string): DateRangeClass {
    const idxData = firstDateRangeIdx(data);

    return data.substring(idxData).match(/CLASS="([\w-]+)"/)?.[1] as DateRangeClass;
}

export function parseM3u8(content: string) {
    const data = [];
    const lines = content.split('\n').filter(Boolean);
    let line;
    while((line = lines.pop())) {
        line = line.substring(1);
        const colIdx = line.indexOf(':');
        if(colIdx === -1) {
            continue;
        }
        const key = line.substring(0, colIdx);
        const value = line.substring(colIdx + 1);
        if(key === 'EXT-X-DATERANGE') {
            data.push(parseAttributes(value));
        }
    }
    return Object.fromEntries(data.map(x => [x.CLASS, x]));
}

export function parseAttributes(str: string) {
    return Object.fromEntries(
      str
        .split(/(?:^|,)((?:[^=]*)=(?:"[^"]*"|[^,]*))/)
        .filter(Boolean)
        .map(x => {
            const idx = x.indexOf('=');
            const key = x.substring(0, idx);
            const value = x.substring(idx +1);
            const num = Number(value);
            return [key, Number.isNaN(num) ? value.startsWith('"') ? JSON.parse(value) : value : num]
        }));
}
