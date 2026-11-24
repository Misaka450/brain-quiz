(function(r){'use strict';r.BrainLab=r.BrainLab||{};const F=Object.freeze;
const C=F({
  VERSION:'1.6.0-50q',TOTAL_POOL_SIZE:50,TIER_COUNTS:F({core:24,pair:24,special:2}),PAIR_BUCKET_SIZE:4,
  DIMENSIONS:F(['V','L','Q','D']),TIE_BREAK_AXIS_ORDER:F(['L','V','Q','D']),ARCHETYPE_COUNT:12,
  AUTH_MODE:'free_preview_4',FREE_PREVIEW_COUNT:4,STAGE1_CORE_BLOCKS:2,STAGE1_CORE_COUNT:8,
  MIN_ORTH_COUNT:15,MAX_ORTH_COUNT:19,FINALE_SPECIAL_COUNT:1,MIN_ASK_COUNT:16,MAX_ASK_COUNT:20,
  STOP_COSINE_GAP_BASE:.02,STOP_COSINE_DECAY:.004,STOP_FLAT_MIN_ORTH:17,STOP_MIN_SPREAD:18,
  P12_GATE:F({maxSpread:20,minMax:62.5,minDim:46,minMean:55.5}),PAIR_DIFF_TIE_PENALTY:.002,
  PAIR_SATURATION_DECAY:F({after2:.85,after3:.68}),RETEST_UNSEEN_BONUS:.22,RECENT_RUN_WINDOW:2,
  META_PERSONAS:F({
    REBEL:F({code:'REBEL',badge:'破壁掀桌派',short:'破壁',desc:'规则失灵时拒绝陪演，宁可承担摩擦成本也要重定边界'}),
    LEVER:F({code:'LEVER',badge:'顺势借壳派',short:'借势',desc:'极善利用既有秩序与外部杠杆，以最小阻力撬动个人跃迁'}),
    SHIELD:F({code:'SHIELD',badge:'底线风控派',short:'守拙',desc:'先算最坏败局再求胜局，永远为自己保留全身而退的筹码'}),
    SHADOW:F({code:'SHADOW',badge:'暗线布局派',short:'藏锋',desc:'看破局势却不抢台面风头，习惯在聚光灯外攒齐决定性底牌'})
  }),
  SSR_VARIANT_RULE:F({minSpread:42,minTop2Score:68,triggerMetaCodes:F(['REBEL','SHADOW']),ssrBadgeText:'SSR · 清醒破壁变异体（约 3.1% 触发）'}),
  HMAC_SECRET:'MXGE_BRAIN_V1_2026_SALT_9F3A',CODE_ALPHABET:'23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
  VALID_PREFIXES:F(['DM','S1','B3','CP']),MAX_CODE_USES:5,LOCAL_FALLBACK:true,ENABLE_REMOTE_TRACKING:false,
  MAX_EVENT_LOGS:500,LOADING_RITUAL_MS:1500,POSTER_SPEC:F({width:750,height:1000,maxDpr:3}),
  STORAGE_KEYS:F({usage:'mxge_code_usage_v1',draft:'mxge_quiz_draft_v15',recentRuns:'mxge_recent_runs_v15',events:'mxge_events_v1'}),
  OFFLINE_COHORT_PARAMS:F({
    modelVersion:'OFFLINE_COHORT_MODEL_V1_5',mu:F({V:54.2,L:54.2,Q:54.2,D:54.2}),sigma:F({V:17.2,L:17.2,Q:17.2,D:17.2}),
    skewness:-.0835,clampMin:5.2,clampMax:99.4,
    dimActionLabels:F({V:'言语潜台词捕捉力',L:'逻辑破局力',Q:'数资直觉敏感度',D:'高压博弈决断力'}),
    dimShortLabels:F({V:'言语洞察',L:'逻辑推演',Q:'数资直觉',D:'高压决断'})
  })
});
r.BrainLab.CONFIG=C;if(typeof module!=='undefined'&&module.exports)module.exports=C;
})(typeof window!=='undefined'?window:globalThis);
