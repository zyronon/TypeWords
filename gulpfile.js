import { src, dest } from 'gulp';
import through from 'through2';
import * as XLSX from 'xlsx';
import * as path from 'path';
import Vinyl from 'vinyl';

// 支持的语言列表
const LANGUAGES = ['en', 'zh', 'id', 'tw', 'th', 'ru', 'vi', 'es', 'pt', 'ja', 'uk', 'ko', 'de', 'fr'];

function excel2i18n() {
  const stream = through.obj(function(file, encode, cb) {
    if (!file.isBuffer()) {
      return cb(null, file);
    }

    const workbook = XLSX.read(file.contents);
    const excelData = XLSX.utils.sheet_to_json(workbook.Sheets['Sheet1']);

    // 为每种语言创建一个翻译对象
    const translations = {};
    LANGUAGES.forEach(lang => {
      translations[lang] = {};
    });

    // 解析 Excel 数据
    excelData.forEach(row => {
      let parsedRow = {};
      for (const key in row) {
        const letterPattern = /[a-zA-Z]+/g;
        const matches = key.match(letterPattern);
        if (matches) {
          const normalizedKey = matches[0].toLowerCase();
          parsedRow[normalizedKey] = row[key].replace(/@{/g, '{');
        }
      }

      // 将每种语言的翻译添加到对应的对象中
      if (parsedRow.key) {
        LANGUAGES.forEach(lang => {
          if (parsedRow[lang]) {
            translations[lang][parsedRow.key] = parsedRow[lang];
          }
        });
      }
    });

    // 为每种语言生成一个 JSON 文件
    LANGUAGES.forEach(lang => {
      if (Object.keys(translations[lang]).length > 0) {
        const langFile = new Vinyl({
          base: file.base,
          path: path.join(file.base, `${lang}.json`),
          contents: Buffer.from(JSON.stringify(translations[lang], null, '\t'))
        });
        this.push(langFile);
      }
    });

    cb();
  });

  return stream;
}

// 将翻译好的 excel 写入多个语言 JSON 文件
function i18nWrite() {
  return src(['../nuxt/i18n/i18n.xlsx'], { encoding: false })
    .pipe(excel2i18n())
    .pipe(dest('../nuxt/i18n/locales'));
}

export { i18nWrite };
