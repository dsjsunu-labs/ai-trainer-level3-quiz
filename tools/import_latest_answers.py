import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def norm(text):
    return re.sub(r'[\s()（）,，.。:：、]', '', text)

def main():
    source = (ROOT / 'docs/latest-docx-text.txt').read_text(encoding='utf-8')
    baseline = ROOT / 'docs/questions-before-v13.json'
    if not baseline.exists():
        raw = (ROOT / 'questions.js').read_text(encoding='utf-8')
        baseline.write_text(raw.removeprefix('window.QUESTION_BANK=').strip().removesuffix(';'), encoding='utf-8')
    bank = json.loads(baseline.read_text(encoding='utf-8'))
    sections = re.split(r'(?m)^[一二三]、(?:判断题|单选题|多选题).*$', source)[1:]
    assert len(sections) == 3
    latest = {}
    for kind, body in zip(('tf', 'single', 'multi'), sections):
        pattern = r'(?m)^（\s*([√×])\s*）(\d+)\.\s*(.*)' if kind == 'tf' else r'(?m)^(\d+)\.\s*(.*)'
        matches = list(re.finditer(pattern, body))
        for i, m in enumerate(matches):
            block = body[m.end():matches[i+1].start() if i+1 < len(matches) else len(body)]
            number = int(m.group(2 if kind == 'tf' else 1))
            stem = m.group(3 if kind == 'tf' else 2)
            explanation = block.split('【解析】', 1)[1].strip() if '【解析】' in block else ''
            answer = [m.group(1)] if kind == 'tf' else re.findall('[A-E]', re.search(r'参考答案：([^\n]+)', block).group(1))
            options = [] if kind == 'tf' else [{'key': chr(int(k)), 'text': t.strip()} for k,t in re.findall(r'(?m)^（(6[5-9])）([^\n]*)', block)]
            key = f'{kind}-{number}'
            assert key not in latest, key
            latest[key] = dict(stem=stem, answer=answer, options=options, explanation=explanation)
    changes, mismatches = [], []
    for q in bank:
        new = latest[q['id']]
        same_stem = norm(q['stem']) == norm(new['stem'])
        same_options = q['type'] == 'tf' or [norm(o['text']) for o in q['options']] == [norm(o['text']) for o in new['options']]
        if not same_stem or not same_options:
            mismatches.append(dict(id=q['id'], old=q['stem'], new=new['stem'], optionsMatch=same_options))
        if sorted(q['answer']) != sorted(new['answer']):
            changes.append(dict(id=q['id'], type=q['type'], number=q['number'], stem=new['stem'], oldAnswer=q['answer'], newAnswer=new['answer']))
    (ROOT / 'docs/answer-comparison.json').write_text(json.dumps(dict(counts=dict(Counter(x['type'] for x in changes)), changes=changes, textDifferences=mismatches, latestCount=len(latest)), ensure_ascii=False, indent=2), encoding='utf-8')
    print('Latest:', len(latest), 'Changed:', dict(Counter(x['type'] for x in changes)), 'Text differences:', len(mismatches))
    for m in mismatches: print(m)
    updated = []
    old_by_id = {q['id']: q for q in bank}
    for key, new in latest.items():
        kind, number = key.split('-')
        old = old_by_id.get(key)
        q = dict(old) if old else dict(id=key, number=int(number), type=kind, topic='综合知识')
        q.update(stem=new['stem'], answer=new['answer'], explanation=new['explanation'])
        if kind != 'tf':
            q['options'] = new['options']
        if old and sorted(old['answer']) != sorted(new['answer']):
            q['previousAnswer'] = old['answer']
        assert set(q['answer']).issubset(o['key'] for o in q['options']), key
        updated.append(q)
    (ROOT / 'questions.js').write_text('window.QUESTION_BANK=' + json.dumps(updated, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    labels = dict(tf='判断题', single='单选题', multi='多选题')
    report = ['# 最新答案差异清单', '', '对比原网站题库与 2026-10-12 最新答案文档。共 227 道，判断 34、单选 38、多选 155。', '', '| 题型 | 原题号 | 旧答案 | 最新答案 | 题干 |', '|---|---:|---|---|---|']
    for c in changes:
        report.append(f"| {labels[c['type']]} | {c['number']} | {'、'.join(c['oldAnswer'])} | {'、'.join(c['newAnswer'])} | {c['stem'].replace('|', '/')} |")
    (ROOT / 'docs/最新答案差异清单.md').write_text('\n'.join(report), encoding='utf-8')

if __name__ == '__main__':
    main()
