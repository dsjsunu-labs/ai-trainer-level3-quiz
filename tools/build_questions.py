import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "3级题目&答案.txt"
ROOT_OUTPUT = ROOT / "questions.js"


TOPICS = [
    ("职业素养", r"职业道德|职业守则|爱岗敬业|职业纪律|职业责任|奉献社会|职业活动|培训"),
    ("法律法规", r"劳动合同|劳动法|知识产权|著作权|专利|商标|网络安全|个人信息|隐私|法律|法规"),
    ("计算机与办公", r"Windows|Word|Excel|浏览器|操作系统|快捷键|工作簿|Power BI|办公"),
    ("数据采集", r"数据采集|数据抓取|爬虫|requests|数据源|传感器|ETL|数据库|云服务"),
    ("数据处理", r"数据清洗|缺失值|异常值|重复值|归一化|标准化|白化|Pandas|NumPy|特征工程|数据转换"),
    ("机器学习", r"机器学习|监督学习|无监督学习|回归|分类|聚类|训练集|验证集|测试集|准确率|召回率|损失函数|过拟合|超参数|CNN|神经网络|TensorFlow|PyTorch|生成对抗"),
    ("数据标注", r"数据标注|标注员|标签|Label|边界框|语义分割|主动学习|标注工具"),
    ("业务与系统", r"业务流程|业务模块|智能客服|推荐系统|智能家居|自动驾驶|智能医疗|智能控制|用户画像|数据分析"),
    ("模型应用", r"模型训练|模型评估|模型部署|模型测试|模型优化|日志|容器|分布式|可视化"),
]


def topic_for(text: str) -> str:
    scores = [(len(re.findall(pattern, text, re.I)), name) for name, pattern in TOPICS]
    score, name = max(scores)
    return name if score else "综合知识"


def parse_section(body: str, qtype: str):
    starts = []
    cursor = 0
    expected_numbers = [n for n in range(1, 301) if not (qtype == "single" and n == 230)]
    for expected in expected_numbers:
        if qtype == "tf":
            pattern = rf"(?m)^\s*[（(]\s*[√×]\s*[）)]\s*{expected}\.\s*"
        else:
            pattern = rf"(?m)^\s*{expected}\.\s*"
        match = re.search(pattern, body[cursor:])
        if not match:
            raise RuntimeError(f"{qtype} 未找到第 {expected} 题，当前位置 {cursor}")
        absolute_start = cursor + match.start()
        absolute_end = cursor + match.end()
        starts.append((expected, absolute_start, absolute_end))
        cursor = absolute_end
    questions = []
    for idx, (number, start, content_start) in enumerate(starts):
        end = starts[idx + 1][1] if idx + 1 < len(starts) else len(body)
        block = body[content_start:end].strip()

        if qtype == "tf":
            prefix = body[start:content_start]
            answer = [re.search(r"[√×]", prefix).group(0)]
            stem = block
            options = [{"key": "√", "text": "正确"}, {"key": "×", "text": "错误"}]
        else:
            all_a = list(re.finditer(r"(?m)^\s*\(A\)\s*", block))
            option_start = None
            for candidate in reversed(all_a):
                tail = block[candidate.start():]
                if all(re.search(rf"(?m)^\s*\({letter}\)\s*", tail) for letter in "BCD"):
                    option_start = candidate.start()
                    break
            if option_start is None:
                raise RuntimeError(f"{qtype} 第 {number} 题找不到完整选项")
            stem_with_answer = block[:option_start].strip()
            answer_match = re.search(r"[（(]([A-E](?:\s*,?\s*[A-E])*)[）)]", stem_with_answer)
            if not answer_match:
                # 源文件少数单选题缺失题干，开头的“(A)选项文字”同时保留了答案。
                # 不擅自补写题意，仅标注原题缺失，仍让用户看到全部原始选项。
                first_key = re.match(r"\s*\(([A-E])\)", block)
                if not stem_with_answer and first_key:
                    answer = [first_key.group(1)]
                    stem = "【原始题库此题题干缺失，请结合选项记忆】"
                else:
                    raise RuntimeError(f"{qtype} 第 {number} 题找不到答案：{stem_with_answer[:80]}")
            else:
                answer = re.findall(r"[A-E]", answer_match.group(1))
                stem = (stem_with_answer[:answer_match.start()] + stem_with_answer[answer_match.end():]).strip()
            stem = re.sub(r"\s+", " ", stem)
            options_block = block[option_start:]
            option_matches = list(re.finditer(r"(?m)^\s*\(([A-E])\)\s*", options_block))
            options = []
            for oi, om in enumerate(option_matches):
                oe = option_matches[oi + 1].start() if oi + 1 < len(option_matches) else len(options_block)
                text = options_block[om.end():oe].strip()
                text = re.sub(r"\s+", " ", text)
                options.append({"key": om.group(1), "text": text})

        questions.append({
            "id": f"{qtype}-{number}",
            "number": number,
            "type": qtype,
            "topic": topic_for(stem),
            "stem": stem,
            "options": options,
            "answer": answer,
        })
    return questions


def main():
    raw = SOURCE.read_text(encoding="utf-8-sig")
    parts = re.split(r"(?m)^\s*[一二三]、(?:判断题|单选题|多选题).*?$", raw)
    if len(parts) != 4:
        raise RuntimeError(f"题库分段失败：得到 {len(parts)} 段")

    questions = []
    questions.extend(parse_section(parts[1], "tf"))
    questions.extend(parse_section(parts[2], "single"))
    questions.extend(parse_section(parts[3], "multi"))

    counts = {kind: sum(q["type"] == kind for q in questions) for kind in ("tf", "single", "multi")}
    if counts != {"tf": 300, "single": 299, "multi": 300}:
        raise RuntimeError(f"题目数量异常：{counts}")

    payload = json.dumps(questions, ensure_ascii=False, separators=(",", ":"))
    rendered = f"window.QUESTION_BANK={payload};\n"
    ROOT_OUTPUT.write_text(rendered, encoding="utf-8")
    print(f"已生成 {len(questions)} 道题：{counts}")
    print(f"题库文件：{ROOT_OUTPUT}")


if __name__ == "__main__":
    main()
