#!/usr/bin/env node
/**
 * 플러스탭 작업 지시서 생성기
 * Usage: node gen-task.js
 */

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q) => new Promise((res) => rl.question(q, res));

// 모듈 설명 매핑
const MODULE_DESC = {
  "001": "KV (키비주얼)",
  "002": "아티클 인트로",
  "003": "본문 타이틀 + 목차 (title-box + callout.ty2)",
  "004": "본문 텍스트 + 이미지",
  "008": "인용/이벤트 정보 박스 (quote-box)",
  "010": "회색 배경 섹션 (plustab-article.bg-gray)",
  "013": "콜아웃 확장 카드 (callout-header + card-info)",
  "014": "콜아웃 아이템 변형 (callout-box + callout-item 구분선형)",
  "015": "콜아웃 바디 블록 (callout-body 아이콘+텍스트 / callout-header 조합)",
  "016": "피드백 픽 박스 (pick-box + pick-comment)",
  "017": "픽박스 스와이퍼 (swiper-box + pick-box)",
  "020": "유튜브 영상 (video-box)",
  "023": "채팅 말풍선 박스 (chat-box / .chat-right / .no-tail Q&A형)",
  "026": "참여형 타이틀 영역 (plustab-article.ptc-wrap + title-box + desc)",
  "027": "중앙 모달 팝업 (modal-popup-box + modal-popup-inner + 스크립트)",
  "031": "네비게이션 + 탑 버튼 (scroll-nav-box + top-btn)",
  "032": "바텀시트 (bottom-sheet + 스크립트)",
};

const TEMPLATE_DESC = {
  1: {
    file: "plustab_template_type1.html",
    label: "투표형",
  },
  2: {
    file: "plustab_template_type2.html",
    label: "일반형",
  },
  3: {
    file: "plustab_template_type3.html",
    label: "밸런스게임형",
  },
};

const CURRENT_SOURCE_RULE = `
## 최신 기준 파일 확인 (최우선)
- 공통 CSS의 유일한 기준은 작업 시점의 \`plustab_template_css.html\`이다.
- 컴포넌트 마크업/클래스는 \`plustab_components.html\`의 현재 내용을 확인한다.
- 공통 CSS의 클래스명이 변경되면 \`plustab_components.html\`, \`gen-task.html\`, \`gen-task.js\`도 함께 업데이트한다.
- type 템플릿, 과거 HTML, 이 지시서의 클래스 설명이 기준 파일과 다르면 기준 파일을 따른다.
- 템플릿 복사 직후 공통 \`<style>\` 영역을 최신 공통 CSS로 전체 교체한다. 기존 CSS와 병합하지 않는다.
- 신규 컴포넌트 CSS가 필요하면 \`/* === 추가 컴포넌트 CSS === */\` 주석의 바로 다음 줄부터 삽입한다. \`</style>\` 직전에 덧붙이지 않는다. 기존 추가 CSS가 있으면 새 CSS를 주석 바로 다음에 넣고 기존 추가 CSS는 뒤에 유지한다.
- 신규 모듈의 대표 래퍼 클래스는 반드시 \`○○○○-box\` 형식으로 작성한다. 내부 요소 클래스에는 이 접미사를 강제하지 않으며, 기존 클래스와 충돌하지 않는지 먼저 검색한다.
- 구현 전 사용할 클래스가 두 기준 파일에 실제로 존재하는지 검색한다.
`.trim();

function parseModules(input) {
  // "module-001, module-002, module-004+module-008, module-004" 형태 파싱
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((combo) =>
      combo.split("+").map((m) =>
        m
          .trim()
          .replace(/^module-?/i, "")
          .padStart(3, "0")
      )
    );
}

function describeModule(codes) {
  return codes.map((c) => MODULE_DESC[c] || `module-${c}`).join(" + ");
}

function needsSwiper(modules) {
  return modules.flat().some((id) => ["005", "017", "031"].includes(id));
}

function buildImageSection(modules, images) {
  const lines = [];
  let imgIdx = 0;
  for (const combo of modules) {
    const hasImage = combo.some((c) =>
      ["001", "004", "005", "010", "020"].includes(c)
    );
    if (!hasImage) continue;
    const label = combo.includes("001")
      ? "module-001 KV 배경이미지"
      : combo.includes("005")
      ? `module-005 슬라이드 이미지 (${
          images.slice(imgIdx).filter((_, i) => i < 4).length
        }장)`
      : `module-${combo[0]} 본문 이미지`;

    if (images[imgIdx]) {
      lines.push(`- **${label}**: \`${images[imgIdx]}\``);
      if (combo.includes("005")) {
        // 슬라이드는 연속 이미지를 묶어서 표시
        const slideImgs = images.slice(imgIdx, imgIdx + 4).filter(Boolean);
        slideImgs.slice(1).forEach((u) => lines.push(`  - \`${u}\``));
        imgIdx += slideImgs.length;
      } else {
        imgIdx++;
      }
    }
  }
  return lines.join("\n");
}

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("   플러스탭 작업 지시서 생성기");
  console.log("═══════════════════════════════════════════\n");

  // 1. 파일명
  const filename = (
    await ask("1. 출력 파일명 (예: DCBGIT-00000): ")
  ).trim();
  if (!/^DCBGIT-\d{5}$/.test(filename)) {
    throw new Error("파일명은 DCBGIT-00000 형식으로 입력해주세요.");
  }
  const outputHtml = `${filename}.html`;

  // 2. 템플릿
  console.log("\n2. 템플릿 선택:");
  Object.entries(TEMPLATE_DESC).forEach(([k, v]) =>
    console.log(`   ${k}) ${v.label}`)
  );
  const tplKey = (await ask("   선택 (1/2/3): ")).trim();
  const tpl = TEMPLATE_DESC[tplKey] || TEMPLATE_DESC["2"];

  // 3. 모듈 구성
  const moduleRaw = await ask(
    "\n3. 모듈 구성 (예: module-001, module-002, module-004+module-008, module-004): "
  );
  const modules = parseModules(moduleRaw);

  // 4. 이미지 URL
  console.log("\n4. 이미지 URL 입력 (순서대로, 빈 줄에서 종료):");
  const images = [];
  let i = 1;
  while (true) {
    const url = (await ask(`   이미지 ${i} URL (빈 줄 = 완료): `)).trim();
    if (!url) break;
    images.push(url);
    i++;
  }

  // 5. Figma URL (기본 해상도)
  const figmaMain = (
    await ask("\n5. Figma 디자인 URL (기본 해상도, 674px): ")
  ).trim();

  // 6. Figma URL (소형 해상도, optional)
  const figmaSmall = (
    await ask("6. Figma 디자인 URL (소형 해상도, 360px, 없으면 빈 줄): ")
  ).trim();

  // 7. 추가 메모
  const memo = (await ask("\n7. 추가 요청사항 (없으면 빈 줄): ")).trim();

  rl.close();

  // ── 작업 지시서 생성 ──
  const moduleList = modules
    .map((combo) => `module-${combo.join("+module-")}`)
    .join(", ");

  const moduleDetailLines = modules
    .map(
      (combo, idx) =>
        `   ${idx + 1}. module-${combo.join("+module-")} — ${describeModule(
          combo
        )}`
    )
    .join("\n");

  const imageSectionLines = buildImageSection(modules, images);

  const brSection = figmaSmall
    ? `
## br 태그 검토
- 소형 해상도(360px) Figma: ${figmaSmall}
- 기본 해상도(674px) Figma: ${figmaMain}
- 두 해상도를 비교해 제목·본문에서 줄바꿈이 달라지는 위치를 찾아 \`<br class="use-50">\` 삽입
`
    : "";

  const swiperNote = needsSwiper(modules)
    ? "\n> ⚠️ Swiper 기능 모듈 포함 → Swiper.js CDN 스크립트 포함 확인\n"
    : "";

  const taskDoc = `
# 플러스탭 작업 지시서 — ${outputHtml}

## 기본 정보
| 항목 | 내용 |
|------|------|
| 출력 파일 | \`${outputHtml}\` |
| 기준 템플릿 | \`${tpl.file}\` (${tpl.label}) |
| Figma (기본) | ${figmaMain} |${
    figmaSmall ? `\n| Figma (소형) | ${figmaSmall} |` : ""
  }

${CURRENT_SOURCE_RULE}

## 모듈 구성
${moduleDetailLines}
${swiperNote}
## 영역별 이미지 URL
${imageSectionLines || "(이미지 없음)"}
${brSection}
## 작업 절차 (workflow.md 기준)

1. \`${tpl.file}\` 을 구조 참고용으로 \`${outputHtml}\` 로 복사
2. 현재 \`plustab_template_css.html\` 내용을 확인하고 복사된 공통 CSS 영역을 전체 교체
3. Figma 디자인 확인: ${figmaMain}${
    figmaSmall ? `\n   소형 해상도: ${figmaSmall}` : ""
  }
4. 모듈 조합: ${moduleList}
5. 이미지 URL 삽입 (위 목록 순서대로)
6. 사용 클래스가 최신 공통 CSS 또는 컴포넌트 파일에 존재하는지 확인
7. 신규 CSS가 있으면 \`/* === 추가 컴포넌트 CSS === */\` 바로 다음에 삽입됐는지와 \`</style>\` 직전에 덧붙은 CSS가 없는지 확인
8. \`var(--)\` 없는지, 인라인 \`style=""\` 없는지, 클래스명 변경 없는지 확인
9. 최신 공통 CSS 일치 여부 및 Figma 원본 디자인을 최종 비교${
    memo ? `\n\n## 추가 요청사항\n${memo}` : ""
  }

---
*생성: gen-task.js | 기준: PLUSTAB_GUIDE.md + workflow.md*
`.trimStart();

  // 출력
  const outFile = `${filename}_task.md`;
  const fs = require("fs");
  fs.writeFileSync(outFile, taskDoc, "utf8");

  console.log("\n═══════════════════════════════════════════");
  console.log(`✅ 작업 지시서 생성 완료: ${outFile}`);
  console.log("═══════════════════════════════════════════\n");
  console.log("── 아래 내용을 ChatGPT/Codex에 붙여넣어 작업 요청 ──\n");
  console.log(taskDoc);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
