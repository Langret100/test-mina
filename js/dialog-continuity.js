// dialog-continuity.js - 대화 연속성 강화 엔진 v2.0
//
// 설계안 기반 4단계 로직:
//   Step 1. 어절 가중치 점수제 매칭 (Scoring)
//   Step 2. 랜덤 키워드 낚시 (Random Hook)
//   Step 3. 글자 단위 유사도 매칭 (Fuzzy Matching)
//   Step 4. 대화 심폐소생 리액션 (No-Match Fallback)
//
// 데이터 소스 (두 가지 모두 활용):
//   A) learnedReactions         - 구글 시트 + 로컬 학습 데이터 (core.js 관리)
//   B) getBuiltinPatternPool()  - dialog.js 내장 패턴 풀 전체 (dialog.js 끝에 노출)
//
// 감정 이미지 연동: 모든 반환값은 { emotion, line } 구조로
//   EMO 시스템과 그대로 호환됨. (core.js 에서 EMO[emotion] 유효성 확인 후 setEmotion 호출)

(function (global) {
  "use strict";

  // ── 조사 제거용 목록 ────────────────────────────────────────────────────────
  var JOSA_TAIL2 = ["에서","에게","한테","이라","라도","부터","까지","처럼","같이","마저","조차","마다","밖에","이랑","하고","이고","이든","든지"];
  var JOSA_TAIL1 = ["은","는","이","가","을","를","의","에","로","과","와","도","만","야","아","고","랑","나","요"];

  // ── 특수 명사: 5점 가중치 ──────────────────────────────────────────────────
  var SPECIAL_NOUNS = ["미나","민수","고스트","유령","학교","학원","게임","수학","영어","과학",
    "엄마","아빠","친구","선생님","시험","숙제","연애","좋아","사랑","행복","슬픔","화남","짜증",
    "오늘","내일","어제","밥","먹었","잠","고민","취미","음악","날씨","운동"];

  // ── 만능 맞장구 풀 (Step 4-B) ──────────────────────────────────────────────
  var BACKCHANNELS = [
    { emotion: "신남",   line: "우와, 진짜? 더 말해줘!" },
    { emotion: "신남",   line: "대박, 그래서 어떻게 됐어?" },
    { emotion: "경청",   line: "오, 그렇구나. 계속 말해줘." },
    { emotion: "경청",   line: "음~ 그래서?" },
    { emotion: "기쁨",   line: "헐, 진짜로?!" },
    { emotion: "경청",   line: "아, 그런 일이 있었구나." },
    { emotion: "신남",   line: "엄청 재밌는데? 계속!" },
    { emotion: "경청",   line: "흠, 나도 그런 생각 해본 적 있어." },
    { emotion: "기쁨",   line: "오오, 진짜 흥미롭다!" },
    { emotion: "경청",   line: "그거 좀 더 얘기해줄 수 있어?" }
  ];

  // ── 유틸: 어절 분리 + 조사 제거 ──────────────────────────────────────────
  function splitWords(text) {
    var t = String(text || "").replace(/[.,!?~\u2026\u201c\u201d\u2018\u2019`]/g, "").trim();
    return t.split(/\s+/).map(function (w) {
      var clean = w;
      if (clean.length > 3) {
        for (var i = 0; i < JOSA_TAIL2.length; i++) {
          var j = JOSA_TAIL2[i];
          if (clean.endsWith(j) && clean.length > j.length + 1) { clean = clean.slice(0, -j.length); break; }
        }
      }
      if (clean.length > 2) {
        for (var k = 0; k < JOSA_TAIL1.length; k++) {
          var j1 = JOSA_TAIL1[k];
          if (clean.endsWith(j1) && clean.length > j1.length + 1) { clean = clean.slice(0, -j1.length); break; }
        }
      }
      return clean;
    }).filter(function (w) { return w.length > 0; });
  }

  function wordScore(word) {
    return SPECIAL_NOUNS.indexOf(word) !== -1 ? 5 : 1;
  }

  function isRecentLine(line) {
    try {
      if (typeof getRecentDialogHistory === "function") {
        var hist = getRecentDialogHistory().slice(-5);
        return hist.some(function (h) { return h && h.line === line; });
      }
    } catch (e) {}
    return false;
  }

  function resolveEmotion(emoName) {
    try {
      if (typeof EMO !== "undefined" && EMO && emoName && EMO[emoName]) return emoName;
    } catch (e) {}
    return "경청";
  }

  // ── 통합 후보 풀 빌더 ────────────────────────────────────────────────────
  // learnedReactions  → { trigger, message, motion }
  // builtin patterns  → { keywords[], lines[], emotion }
  // → 공통 형식 { keywords[], rawKeywords[], lines[], emotion, source } 로 통합
  function buildUnifiedPool(reactions) {
    var pool = [];

    // A) 학습 데이터 (구글 시트 + 로컬)
    if (Array.isArray(reactions)) {
      reactions.forEach(function (r) {
        if (!r || !r.trigger || !r.message) return;
        pool.push({
          keywords: splitWords(r.trigger),
          rawKeywords: [String(r.trigger)],
          lines: [String(r.message)],
          emotion: String(r.motion || "경청"),
          source: "learned"
        });
      });
    }

    // B) dialog.js 내장 패턴 풀
    if (typeof getBuiltinPatternPool === "function") {
      try {
        var builtins = getBuiltinPatternPool();
        builtins.forEach(function (p) {
          if (!p || !Array.isArray(p.keywords) || !Array.isArray(p.lines)) return;
          pool.push({
            keywords: p.keywords.map(function (kw) { return String(kw); }),
            rawKeywords: p.keywords.map(function (kw) { return String(kw); }),
            lines: p.lines,
            emotion: String(p.emotion || "경청"),
            source: "builtin"
          });
        });
      } catch (e) {}
    }

    return pool;
  }

  // ── Step 1: 어절 가중치 점수제 매칭 ────────────────────────────────────
  function scoringMatch(raw, pool) {
    if (!pool.length) return null;
    var inputWords = splitWords(raw);
    if (!inputWords.length) return null;

    var candidates = [];
    pool.forEach(function (entry) {
      var score = 0;
      entry.keywords.forEach(function (kw) {
        if (inputWords.indexOf(kw) !== -1) score += wordScore(kw);
        else if (raw.includes(kw)) score += wordScore(kw) * 0.5;
      });
      if (score > 0) candidates.push({ score: score, entry: entry });
    });

    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return b.score - a.score; });
    var topScore = candidates[0].score;

    var topPool = candidates.filter(function (c) { return c.score >= topScore; });
    var freshPool = topPool.filter(function (c) {
      return c.entry.lines.some(function (l) { return !isRecentLine(l); });
    });
    var pool2 = freshPool.length ? freshPool : topPool;
    var chosen = pool2[Math.floor(Math.random() * pool2.length)];
    var lines = chosen.entry.lines.filter(function (l) { return !isRecentLine(l); });
    if (!lines.length) lines = chosen.entry.lines;
    return { emotion: resolveEmotion(chosen.entry.emotion), line: lines[Math.floor(Math.random() * lines.length)], source: chosen.entry.source };
  }

  // ── Step 2: 랜덤 키워드 낚시 ─────────────────────────────────────────
  function randomHookMatch(raw, pool) {
    if (!pool.length) return null;
    var inputWords = splitWords(raw);
    if (!inputWords.length) return null;

    var bucket = pool.filter(function (entry) {
      return entry.keywords.some(function (kw) {
        return inputWords.indexOf(kw) !== -1 || raw.includes(kw);
      });
    });

    if (!bucket.length) return null;
    // 내장/학습 모두 포함된 버킷에서 완전 무작위
    var fresh = bucket.filter(function (e) {
      return e.lines.some(function (l) { return !isRecentLine(l); });
    });
    var usePool = fresh.length ? fresh : bucket;
    var picked = usePool[Math.floor(Math.random() * usePool.length)];
    var lines = picked.lines.filter(function (l) { return !isRecentLine(l); });
    if (!lines.length) lines = picked.lines;
    return { emotion: resolveEmotion(picked.emotion), line: lines[Math.floor(Math.random() * lines.length)], source: picked.source };
  }

  // ── Step 3: 글자 단위 유사도 매칭 (n-gram) ──────────────────────────
  function fuzzyMatch(raw, pool) {
    if (!pool.length) return null;
    var compact = String(raw || "").replace(/\s+/g, "");
    if (compact.length < 2) return null;

    function ngrams(str, n) {
      var result = [];
      for (var i = 0; i <= str.length - n; i++) result.push(str.slice(i, i + n));
      return result;
    }

    var inputBi  = ngrams(compact, 2);
    var inputTri = ngrams(compact, 3);
    if (!inputBi.length) return null;

    var bestScore = 1;
    var bestCandidates = [];

    pool.forEach(function (entry) {
      var triggerStr = entry.rawKeywords.join("").replace(/\s+/g, "");
      if (triggerStr.length < 2) return;
      var trigBiSet  = {};
      var trigTriSet = {};
      ngrams(triggerStr, 2).forEach(function (b) { trigBiSet[b] = true; });
      ngrams(triggerStr, 3).forEach(function (t) { trigTriSet[t] = true; });

      var score = 0;
      inputBi.forEach(function (b)  { if (trigBiSet[b])  score += 1; });
      inputTri.forEach(function (t) { if (trigTriSet[t]) score += 2; });

      if (score > bestScore) { bestScore = score; bestCandidates = [entry]; }
      else if (score === bestScore && score > 1) bestCandidates.push(entry);
    });

    if (!bestCandidates.length) return null;
    var fresh = bestCandidates.filter(function (e) {
      return e.lines.some(function (l) { return !isRecentLine(l); });
    });
    var pool3 = fresh.length ? fresh : bestCandidates;
    var picked = pool3[Math.floor(Math.random() * pool3.length)];
    var lines = picked.lines.filter(function (l) { return !isRecentLine(l); });
    if (!lines.length) lines = picked.lines;
    return { emotion: resolveEmotion(picked.emotion), line: lines[Math.floor(Math.random() * lines.length)], source: picked.source };
  }

  // ── Step 4: 대화 심폐소생 리액션 ────────────────────────────────────
  function noMatchFallback(raw, pool) {
    var strategy = Math.floor(Math.random() * 3);

    // A: 입력 단어 되묻기
    if (strategy === 0) {
      var words = splitWords(raw).filter(function (w) { return w.length >= 2; });
      if (words.length > 0) {
        var w = words[Math.floor(Math.random() * words.length)];
        return { emotion: "경청", line: w + "? 그건 뭐야?", source: "fallback_ask" };
      }
    }

    // B: 만능 맞장구
    if (strategy === 1) {
      var fresh = BACKCHANNELS.filter(function (b) { return !isRecentLine(b.line); });
      var bPool = fresh.length ? fresh : BACKCHANNELS;
      var picked = bPool[Math.floor(Math.random() * bPool.length)];
      return { emotion: picked.emotion, line: picked.line, source: "fallback_backchannel" };
    }

    // C: 화제 전환 - 통합 풀(학습+내장) 중 무작위
    if (pool.length) {
      var freshPool = pool.filter(function (e) {
        return e.lines.some(function (l) { return !isRecentLine(l); });
      });
      var usePool = freshPool.length ? freshPool : pool;
      var entry = usePool[Math.floor(Math.random() * usePool.length)];
      var lines = entry.lines.filter(function (l) { return !isRecentLine(l); });
      if (!lines.length) lines = entry.lines;
      return { emotion: resolveEmotion(entry.emotion), line: lines[Math.floor(Math.random() * lines.length)], source: "fallback_topic_" + entry.source };
    }

    // 최후 안전망
    var safe = BACKCHANNELS[Math.floor(Math.random() * BACKCHANNELS.length)];
    return { emotion: safe.emotion, line: safe.line, source: "fallback_safe" };
  }

  // ── 메인 진입점 ────────────────────────────────────────────────────────
  /**
   * 4단계 연속성 로직 실행.
   * core.js 에서 learnedResp / builtinResp 모두 generic_unknown 이거나 null 일 때 호출.
   *
   * @param {string} raw        사용자 입력 원문
   * @param {Array}  reactions  learnedReactions 배열 (core.js 에서 전달)
   * @returns {{ emotion: string, line: string, source: string }}
   */
  function getContinuityResponse(raw, reactions) {
    var pool = buildUnifiedPool(reactions);

    var scored = scoringMatch(raw, pool);
    if (scored && scored.line) return scored;

    var hooked = randomHookMatch(raw, pool);
    if (hooked && hooked.line) return hooked;

    var fuzzy = fuzzyMatch(raw, pool);
    if (fuzzy && fuzzy.line) return fuzzy;

    return noMatchFallback(raw, pool);
  }

  // ── 전역 노출 ──────────────────────────────────────────────────────────
  global.getContinuityResponse = getContinuityResponse;
  global.__dialogContinuity = {
    buildUnifiedPool:  buildUnifiedPool,
    scoringMatch:      scoringMatch,
    randomHookMatch:   randomHookMatch,
    fuzzyMatch:        fuzzyMatch,
    noMatchFallback:   noMatchFallback,
    splitWords:        splitWords
  };

}(typeof window !== "undefined" ? window : this));
