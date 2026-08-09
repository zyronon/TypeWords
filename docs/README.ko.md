<h1 align=center>
  <img src="https://github.com/user-attachments/assets/9d626e0f-0601-4640-8981-ad66d8ac4853" alt="TypeWords" style="width: 500px;"/>
</h1>

<p align="center">
  <a href="/README.md">English</a> |
  <a href="/docs/README.es.md">Español</a> |
  <a href="/docs/README.de.md">Deutsch</a> |
  <a href="/docs/README.fr.md">Français</a> |
  <a href="/docs/README.pt.md">Português</a> |
  <a href="/docs/README.ru.md">Русский</a> |
  <a href="/docs/README.uk.md">Українська</a> |
  <a href="/docs/README.ja.md">日本語</a> |
  <a href="/docs/README.ko.md">한국인</a> |
  <a href="/docs/README.th.md">ไทย</a> |
  <a href="/docs/README.vi.md">Tiếng Việt</a> |
  <a href="/docs/README.id.md">Bahasa Indonesia</a> |
  <a href="/docs/README.zh-TW.md">繁體中文</a> |
  <a href="/docs/README.zh-CN.md">简体中文</a> 
</p>


<p align="center">
  <b>영어 학습, 한 번의 타이핑으로 한 걸음 전진; 더 이상 막연한 암기가 아닌, 더 효율적인 학습 - 오픈소스 단어 및 문장 연습 도구</b>
</p>

## 온라인 접속

[https://typewords.cc](https://typewords.cc)

<img width="1920" height="1440" alt="practice words" src="/public/imgs/words.png" />
<img width="1920" height="1440" alt="practice articles" src="/public/imgs/articles.png" />

## 기능 목록

### 단어 연습

- 연습 모드: 따라쓰기 / 받아쓰기 / 자가 테스트 / 암기
- 스마트 모드: 기억 곡선을 기반으로 학습 단어를 자동 계산하고, 받아쓰기를 통해 기억을 강화
- 자유 모드: 제한 없이 자유롭게 계획
- 발음 기호, 발음(미국식/영국식), 예문, 구문, 동의어, 어근, 어원, 오류 통계 등 기능 제공

### 문장 암기

- 클래식 교과서 내장, 문장 추가 및 가져오기 가능, 원클릭 번역 및 이중 언어 비교 기능
- 따라쓰기 + 받아쓰기 듀얼 모드, 문장별 입력, 자동 발음으로 더 효율적인 암기
- 들으면서 쓰기 기능으로 기억 강화

### 즐겨찾기, 오답 노트, 숙달 완료

- 학습 중 입력 오류가 발생한 단어는 자동으로 오답 노트에 추가되어 나중에 복습하기 편리
- 숙달 완료에 추가하면 이후 학습 시 자동으로 건너뜀
- 즐겨찾기에 추가하여 복습 강화

### 높은 자유도

- 풍부한 키보드 효과음
- 사용자 정의 단축키
- 높은 수준의 사용자 정의 설정 옵션

### 간결하고 효율적

- 심플한 디자인, 현대적인 UI, 광고 없음
- 깔끔한 인터페이스, 간단한 조작
- 플랫폼 강제 구독 없음

### 단어장

CET-4, CET-6, GMAT, GRE, IELTS, SAT, TOEFL, 대학원 영어, 전문 영어 4급, 전문 영어 8급 등 일반적으로 사용되는 단어장 내장.
대부분의 사용자의 단어 학습 요구를 충족하도록 설계되었습니다. 커뮤니티의 추가 단어장 기여를 환영합니다.

## 실행 방법

#### 참고: 이 프로젝트는 독립적으로 실행할 수 있으며 데이터는 로컬에 저장됩니다. 기기를 변경할 때는 수동 백업이 필요하지만 정상적인 사용에는 영향을 미치지 않습니다.
이 프로젝트는 `Nuxt`로 구축되었으며 Node.js 환경이 필요합니다.

1. NodeJS 설치, [공식 문서](https://nodejs.org/en/download) 참조
2. 프로젝트 파일이 크므로 `git clone --depth 1 https://github.com/zyronon/TypeWords.git` 명령으로 최신 커밋만 클론하는 것을 권장합니다. GitHub의 Download ZIP 기능은 제대로 작동하지 않습니다.
3. 프로젝트 루트 디렉토리에서 터미널을 열고 `pnpm install`을 실행하여 종속성을 다운로드합니다.
4. `pnpm run dev`를 실행하여 프로젝트를 시작합니다. 기본 주소는 [`http://localhost:5567`](http://localhost:5567)입니다.
5. 브라우저에서 [`http://localhost:5567`](http://localhost:5567)을 열어 프로젝트에 접속합니다.
6. `pnpm run generate`를 실행하여 프로젝트 파일을 빌드합니다.

## 기능 및 제안

프로젝트는 현재 초기 개발 단계이며 새로운 기능이 계속 추가되고 있습니다. 소프트웨어에 대한 제안이나 기능 요청이 있으면 `Issues`에서 자유롭게 제안해 주세요.
이 소프트웨어의 디자인 철학이 마음에 드신다면 `PR`을 제출해 주세요. 지원해 주셔서 감사합니다!

## 기여 가이드

[기여 지침](/docs/CONTRIBUTING.md)

이 프로젝트에 관심이 있으시다면 기여를 환영합니다. 최대한 도움을 드리겠습니다.

기여하기 전에 코드 충돌을 방지하기 위해 개발자와 소통해 주세요.

기여해 주셔서 다시 한번 감사드립니다!

