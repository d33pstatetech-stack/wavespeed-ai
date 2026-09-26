// Curated LoRA seed data for the quick picker.
//
// Two lists share one shape so the picker can treat them identically:
//   CURATED_LORAS — general-purpose community adapters, used by the 'HF' variant.
//   NSFW_LORAS    — uncensored / adult adapters, used by the 'NSFW' variant.
//
// These are public community checkpoints on the Hugging Face Hub. They are a
// convenience seed set, not an endorsement: add, remove, or replace entries to
// suit a workflow. Anything added at runtime through the "Add LoRA from URL"
// box is stored in D1 instead and merged in at runtime.
//
// Per-entry fields:
//   id               Hugging Face owner/repo (also the dedupe key for D1)
//   name             display name
//   base_model       stamped base model — drives the compatibility family
//   pipeline         'text-to-image' | 'image-to-image' | 'video-generation'
//   instance_prompt  single trigger word, if the adapter uses one
//   triggers         multiple trigger words, where applicable
//   strength         suggested LoRA strength range
//   file             weight filename
//   repo_url         https://huggingface.co/<id>
//   file_url         direct .safetensors URL
//   formats          per-service recommended strings (R=Replicate W=WaveSpeed M=MuAPI)
//   preferred        'file' marks the direct-URL form as the one to Fill first
//   suggested_target human-readable note about where the adapter applies
//   note             free-text detail shown in the card

export const CURATED_LORAS = [
  {
    id: 'Norod78/Flux_1_Dev_LoRA_Paper-Cutout-Style',
    name: 'Paper Cutout Style (FLUX.1-dev)',
    base_model: 'black-forest-labs/FLUX.1-dev',
    pipeline: 'text-to-image',
    private: false,
    file: 'Flux_1_Dev_LoRA_Paper-Cutout-Style.safetensors',
    repo_url: 'https://huggingface.co/Norod78/Flux_1_Dev_LoRA_Paper-Cutout-Style',
    file_url: 'https://huggingface.co/Norod78/Flux_1_Dev_LoRA_Paper-Cutout-Style/resolve/main/Flux_1_Dev_LoRA_Paper-Cutout-Style.safetensors',
    suggested_target: 'flux-dev-lora / flux-1-dev-style-lora-inference (lora_url)',
    note: 'Flat paper-craft aesthetic. No trigger word. 172 MB.',
  },
  {
    id: 'fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA',
    name: 'Multiple Angles (Qwen-Image-Edit-2511)',
    base_model: 'Qwen/Qwen-Image-Edit-2511',
    pipeline: 'image-to-image',
    private: false,
    file: 'qwen-image-edit-2511-multiple-angles-lora.safetensors',
    repo_url: 'https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA',
    file_url: 'https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA/resolve/main/qwen-image-edit-2511-multiple-angles-lora.safetensors',
    suggested_target: 'qwen-image-edit lora slots (lora_list)',
    note: 'Camera-angle control for edit pipelines. No trigger word. 295 MB. Apache-2.0.',
  },
  {
    id: 'Wuli-art/Qwen-Image-2512-Turbo-LoRA',
    name: 'Turbo 4-step (Qwen-Image-2512)',
    base_model: 'Qwen/Qwen-Image-2512',
    pipeline: 'text-to-image',
    private: false,
    strength: '1.0',
    file: 'Wuli-Qwen-Image-2512-Turbo-LoRA-4steps-V3.0-bf16.safetensors',
    repo_url: 'https://huggingface.co/Wuli-art/Qwen-Image-2512-Turbo-LoRA',
    file_url: 'https://huggingface.co/Wuli-art/Qwen-Image-2512-Turbo-LoRA/resolve/main/Wuli-Qwen-Image-2512-Turbo-LoRA-4steps-V3.0-bf16.safetensors',
    preferred: 'file',
    suggested_target: 'qwen-image-text-to-image-2512-lora (lora_list)',
    note: 'Step-distilled for 4-step sampling. Pair with a matching low step count. 1.2 GB. Apache-2.0.',
  },
  {
    id: 'gokaygokay/Krea-2-Realism-LoRA',
    name: 'Realism (Krea-2-Raw)',
    base_model: 'krea/Krea-2-Raw',
    pipeline: 'text-to-image',
    private: false,
    file: 'krea2_realism_lora.safetensors',
    repo_url: 'https://huggingface.co/gokaygokay/Krea-2-Realism-LoRA',
    file_url: 'https://huggingface.co/gokaygokay/Krea-2-Realism-LoRA/resolve/main/krea2_realism_lora.safetensors',
    suggested_target: 'krea raw / large lora slots (loras)',
    note: 'Photorealism bias for the Raw checkpoint. No trigger word. 469 MB.',
  },
  {
    id: 'lvladikov/Krea2-Turbo-Distill-4step-LoRA',
    name: 'Turbo Distill 4-step (Krea-2-Turbo)',
    base_model: 'krea/Krea-2-Turbo',
    pipeline: 'text-to-image',
    private: false,
    strength: '1.0',
    file: 'krea2_turbo_4step_rank_64_lora.safetensors',
    repo_url: 'https://huggingface.co/lvladikov/Krea2-Turbo-Distill-4step-LoRA',
    file_url: 'https://huggingface.co/lvladikov/Krea2-Turbo-Distill-4step-LoRA/resolve/main/krea2_turbo_4step_rank_64_lora.safetensors',
    preferred: 'file',
    suggested_target: 'krea-v2-turbo-lora (loras)',
    note: 'Step distillation for the Turbo checkpoint. No trigger word. 438 MB.',
  },
  {
    id: 'jasbloom/Wan2.1-I2V-14B-720P-Diffusers-mmxxii-rank256-lora',
    name: 'mmxxii rank256 (Wan2.1 I2V 720P)',
    base_model: 'Wan-AI/Wan2.1-I2V-14B-720P-Diffusers',
    pipeline: 'video-generation',
    private: false,
    file: 'Wan2.1-I2V-14B-720P-Diffusers-mmxxii-rank256.safetensors',
    repo_url: 'https://huggingface.co/jasbloom/Wan2.1-I2V-14B-720P-Diffusers-mmxxii-rank256-lora',
    file_url: 'https://huggingface.co/jasbloom/Wan2.1-I2V-14B-720P-Diffusers-mmxxii-rank256-lora/resolve/main/Wan2.1-I2V-14B-720P-Diffusers-mmxxii-rank256.safetensors',
    suggested_target: 'wan2.1-lora-i2v (lora_list)',
    note: 'Style adapter for Wan 2.1 image-to-video at 720P. No trigger word. 2.9 GB.',
  },
];

export const OWN_LORAS = [    {
      id: "D33pStateTech/aznten-flux.1-dev-replicate",
      name: "aznten-flux.1-dev-replicate",
      base_model: "black-forest-labs/FLUX.1-dev",
      pipeline: "text-to-image",
      private: false,
      instance_prompt: "aznten",
      file: "aznten-flux.1-dev-replicate_Lora.safetensors",
      repo_url: "https://huggingface.co/D33pStateTech/aznten-flux.1-dev-replicate",
      file_url: "https://huggingface.co/D33pStateTech/aznten-flux.1-dev-replicate/resolve/main/aznten-flux.1-dev-replicate_Lora.safetensors",
      suggested_target: "flux-1-dev-style-lora-inference (lora_url) / aznten_replicate (extra_lora)",
      replicate_model: "d33pstatetech-stack/aznten_replicate",
      muapi_model: "flux-1-dev-style-lora-inference",
      note: "FLUX.1-dev LoRA, trigger 'aznten'. Use as lora_url on MuAPI or extra_lora on Replicate AZNTEN (model=dev)."
    },
    {
      id: "D33pStateTech/aznten-flux-schnell-mimicpc",
      name: "aznten-flux-schnell-mimicpc",
      base_model: "black-forest-labs/FLUX.1-schnell",
      pipeline: "text-to-image",
      private: false,
      instance_prompt: "aznten",
      file: "aznten-flux-schnell-mimicpc.safetensors",
      repo_url: "https://huggingface.co/D33pStateTech/aznten-flux-schnell-mimicpc",
      file_url: "https://huggingface.co/D33pStateTech/aznten-flux-schnell-mimicpc/resolve/main/aznten-flux-schnell-mimicpc.safetensors",
      suggested_target: "aznten_replicate (model=schnell, extra_lora)",
      replicate_model: "d33pstatetech-stack/aznten_replicate",
      muapi_model: "flux-schnell",
      note: "FLUX.1-schnell LoRA, trigger 'aznten'. Checkpoint variant aznten-flux-schnell-mimicpc-000004.safetensors also in repo. Use as extra_lora with model=schnell."
    },
    {
      id: "D33pStateTech/aznten-Qwen-Image-2512-Lora-WaveSpeed-AI",
      name: "aznten-Qwen-Image-2512-Lora-WaveSpeed-AI",
      base_model: "Qwen/Qwen-Image-2512",
      pipeline: "text-to-image",
      private: false,
      instance_prompt: "aznten",
      file: "aznten-Qwen-Image-2512-Lora-WaveSpeed-AI.safetensors",
      repo_url: "https://huggingface.co/D33pStateTech/aznten-Qwen-Image-2512-Lora-WaveSpeed-AI",
      file_url: "https://huggingface.co/D33pStateTech/aznten-Qwen-Image-2512-Lora-WaveSpeed-AI/resolve/main/aznten-Qwen-Image-2512-Lora-WaveSpeed-AI.safetensors",
      suggested_target: "qwen-image-text-to-image-2512-lora (loras)",
      replicate_model: "qwen/qwen-image",
      muapi_model: "qwen-image-text-to-image-2512-lora",
      note: "Qwen-Image-2512 LoRA, trigger 'aznten'. For MuAPI use qwen-image-text-to-image-2512-lora ΓåÆ loras: [{\"path\":\"...\",\"scale\":1}]. For Replicate use qwen/qwen-image ΓåÆ lora_weights."
    },
    {
      id: "D33pStateTech/d33pstateten",
      name: "d33pstateten",
      base_model: "krea/Krea-2-Raw",
      pipeline: "text-to-image",
      private: false,
      instance_prompt: "aznten",
      file: "pytorch_lora_weights.safetensors",
      repo_url: "https://huggingface.co/D33pStateTech/d33pstateten",
      file_url: "https://huggingface.co/D33pStateTech/d33pstateten/resolve/main/pytorch_lora_weights.safetensors",
      suggested_target: "krea-v2-turbo-lora (loras) or any Krea-2 via diffusers",
      replicate_model: "krea/krea-2-large",
      muapi_model: "krea-v2-turbo-lora",
      note: "Krea-2-Raw LoRA, trigger aznten. Public repo. For MuAPI use krea-v2-turbo-lora ΓåÆ loras: [{\"path\":\"...\",\"scale\":1}]"
    },
    {
      id: "D33pStateTech/d33pstateLora",
      name: "d33pstateLora",
      base_model: "black-forest-labs/FLUX.1-dev",
      pipeline: "text-to-image",
      private: false,
      instance_prompt: "asian ten",
      file: "flux-asian-ten-v2-000024.safetensors",
      repo_url: "https://huggingface.co/D33pStateTech/d33pstateLora",
      file_url: "https://huggingface.co/D33pStateTech/d33pstateLora/resolve/main/flux-asian-ten-v2-000024.safetensors",
      suggested_target: "flux-dev-lora or flux-1-dev-style-lora-inference (lora_url) / aznten_replicate (extra_lora)",
      muapi_model: "flux-1-dev-style-lora-inference",
      note: "FLUX.1-dev LoRA, trigger 'asian ten'. Use as lora_url on MuAPI or extra_lora on Replicate AZNTEN."
    },
    {
      id: "D33pStateTech/asian-ten-wan21-lora",
      name: "asian-ten-wan21-lora",
      base_model: "Wan-AI/Wan2.1-T2V-14B",
      pipeline: "video-generation",
      private: false,
      instance_prompt: "",
      file: "asian_ten_wan21.safetensors",
      repo_url: "https://huggingface.co/D33pStateTech/asian-ten-wan21-lora",
      file_url: "https://huggingface.co/D33pStateTech/asian-ten-wan21-lora/resolve/main/asian_ten_wan21.safetensors",
      suggested_target: "wan2.1-lora-t2v / wan2.1-lora-i2v / wavespeedai/wan-2.1-t2v-480p (lora_weights)",
      muapi_model: "wan2.1-lora-t2v",
      note: "Wan2.1 T2V LoRA ΓÇö use as lora_weights on wavespeedai/wan-2.1-t2v-480p or MuAPI wan2.1-lora-*"
    }
  ];

// The picker's default variant shows both the public seed set and the owner's
// own adapters. Kept as a separate export so either list can be swapped out
// independently.
export const USER_LORAS = [...CURATED_LORAS, ...OWN_LORAS];

// Uncensored and adult-oriented adapters, kept in a separate variant so the
// default picker stays clean. These are ordinary public community checkpoints;
// the only thing separating them is the bucket they appear in. Handle them the
// same way as any other adapter, and note that the models consuming them may
// still apply their own content policy.
export const NSFW_LORAS = [
  {
    id: 'xey/sldr_flux_nsfw_v2-studio',
    name: 'sldr_flux_nsfw_v2-studio',
    base_model: 'black-forest-labs/FLUX.1-dev',
    pipeline: 'text-to-image',
    private: false,
    file: 'sldr_flux_nsfw_v2-studio.safetensors',
    repo_url: 'https://huggingface.co/xey/sldr_flux_nsfw_v2-studio',
    file_url: 'https://huggingface.co/xey/sldr_flux_nsfw_v2-studio/resolve/main/sldr_flux_nsfw_v2-studio.safetensors',
    replicate_model: 'd33pstatetech-stack/aznten_replicate',
    suggested_target: 'flux-1-dev-style-lora-inference (lora_url)',
    note: '307 likes · 1.1M downloads. Photorealistic-oriented adapter. No documented trigger. 687 MB.',
  },
  {
    id: 'lustlyai/Flux_Lustly.ai_Uncensored_nsfw_v1',
    name: 'Flux_Lustly.ai_Uncensored_nsfw_v1',
    base_model: 'black-forest-labs/FLUX.1-dev',
    pipeline: 'text-to-image',
    private: false,
    file: 'flux_lustly-ai_v1.safetensors',
    repo_url: 'https://huggingface.co/lustlyai/Flux_Lustly.ai_Uncensored_nsfw_v1',
    file_url: 'https://huggingface.co/lustlyai/Flux_Lustly.ai_Uncensored_nsfw_v1/resolve/main/flux_lustly-ai_v1.safetensors',
    replicate_model: 'd33pstatetech-stack/aznten_replicate',
    suggested_target: 'flux-1-dev-style-lora-inference (lora_url)',
    note: '275 likes · 155.5K downloads. General uncensored adapter. No trigger word. 344 MB.',
  },
  {
    id: 'lexa862/NSFWmodel',
    name: 'NSFWmodel',
    base_model: 'black-forest-labs/FLUX.1-dev',
    pipeline: 'text-to-image',
    private: false,
    instance_prompt: 'Nude',
    file: 'NSFW_master.safetensors',
    repo_url: 'https://huggingface.co/lexa862/NSFWmodel',
    file_url: 'https://huggingface.co/lexa862/NSFWmodel/resolve/main/NSFW_master.safetensors',
    replicate_model: 'd33pstatetech-stack/aznten_replicate',
    suggested_target: 'flux-1-dev-style-lora-inference (lora_url)',
    note: "78 likes · 459.7K downloads. Trigger 'Nude'. 172 MB, permissive unlicense.",
  },
  {
    id: 'Keltezaa/NSFW_MASTER_FLUX',
    name: 'NSFW_MASTER_FLUX',
    base_model: 'black-forest-labs/FLUX.1-dev',
    pipeline: 'text-to-image',
    private: false,
    instance_prompt: 'NSFW',
    triggers: ['NSFW', 'Nude'],
    file: 'NSFW_master_Flux.safetensors',
    repo_url: 'https://huggingface.co/Keltezaa/NSFW_MASTER_FLUX',
    file_url: 'https://huggingface.co/Keltezaa/NSFW_MASTER_FLUX/resolve/main/NSFW_master_Flux.safetensors',
    replicate_model: 'd33pstatetech-stack/aznten_replicate',
    suggested_target: 'flux-1-dev-style-lora-inference (lora_url)',
    note: "68 likes · 30.3K downloads. Triggers 'NSFW' or 'Nude'. 172 MB. MIT.",
  },
  {
    id: 'imagepipeline/flux_uncensored_nsfw_v2',
    name: 'flux_uncensored_nsfw_v2',
    base_model: 'black-forest-labs/FLUX.1-dev',
    pipeline: 'text-to-image',
    private: false,
    file: 'lora.safetensors',
    repo_url: 'https://huggingface.co/imagepipeline/flux_uncensored_nsfw_v2',
    file_url: 'https://huggingface.co/imagepipeline/flux_uncensored_nsfw_v2/resolve/main/lora.safetensors',
    replicate_model: 'd33pstatetech-stack/aznten_replicate',
    suggested_target: 'flux-1-dev-style-lora-inference (lora_url)',
    note: '34 likes · 33.1K downloads. Tagged ultra-realistic. No documented trigger. 687 MB.',
  },
  {
    id: 'starsfriday/Qwen-Image-NSFW',
    name: 'Qwen-Image-NSFW (Qwen)',
    base_model: 'Qwen-Image-2512',
    pipeline: 'text-to-image',
    private: false,
    instance_prompt: 'rsq',
    triggers: ['rsq'],
    strength: '0.6–1.0',
    file: 'qwen_image_nsfw.safetensors',
    repo_url: 'https://huggingface.co/starsfriday/Qwen-Image-NSFW',
    file_url: 'https://huggingface.co/starsfriday/Qwen-Image-NSFW/resolve/main/qwen_image_nsfw.safetensors',
    formats: {
      replicate: 'huggingface.co/starsfriday/Qwen-Image-NSFW',
      wavespeed: 'starsfriday/Qwen-Image-NSFW',
      muapi: 'https://huggingface.co/starsfriday/Qwen-Image-NSFW/resolve/main/qwen_image_nsfw.safetensors',
    },
    preferred: 'file',
    suggested_target: 'qwen-image-text-to-image-2512-lora (lora_list)',
    note: "General uncensored adapter for Qwen-Image-2512. Trigger 'rsq'. Pair with strength 0.6–1.0.",
  },
  {
    id: 'Sentinel7/qwen-image-qwen4play',
    name: 'Qwen4Play 2512 v1/v2 (Qwen)',
    base_model: 'Qwen-Image-2512',
    pipeline: 'text-to-image',
    private: false,
    instance_prompt: 'bl0wj0b',
    triggers: ['bl0wj0b', 'c0wg1rl'],
    strength: '0.8–1.0',
    file: 'Qwen4Play-2512.1_e10.safetensors',
    repo_url: 'https://huggingface.co/Sentinel7/qwen-image',
    file_url: 'https://huggingface.co/Sentinel7/qwen-image/resolve/main/2004155/2611939/Qwen4Play-2512.1_e10.safetensors',
    civitai: 'civitai:2004155@2611939',
    formats: {
      replicate: 'https://huggingface.co/Sentinel7/qwen-image/resolve/main/2004155/2611939/Qwen4Play-2512.1_e10.safetensors',
      wavespeed: 'https://huggingface.co/Sentinel7/qwen-image/resolve/main/2004155/2611939/Qwen4Play-2512.1_e10.safetensors',
      muapi: 'civitai:2004155@2611939',
    },
    preferred: 'file',
    suggested_target: 'qwen-image-text-to-image-2512-lora (lora_list)',
    note: 'Act-specific LoRA (Civitai mirror). Subfolder file — full URL required on WaveSpeed/Replicate; civitai: shorthand preferred on MuAPI. Triggers vary by act, or none required.',
  },
  {
    id: 'Sentinel7/qwen-image-naturalbeauty',
    name: 'NaturalBeauty Nudity (Qwen)',
    base_model: 'Qwen-Image-2512',
    pipeline: 'text-to-image',
    private: false,
    instance_prompt: 'naked',
    triggers: ['naked', 'topless'],
    strength: '0.6–1.0',
    file: 'NaturalBeautyQwenImage2512Nudity.safetensors',
    repo_url: 'https://huggingface.co/Sentinel7/qwen-image',
    file_url: 'https://huggingface.co/Sentinel7/qwen-image/resolve/main/2322700/2612959/NaturalBeautyQwenImage2512Nudity.safetensors',
    formats: {
      replicate: 'https://huggingface.co/Sentinel7/qwen-image/resolve/main/2322700/2612959/NaturalBeautyQwenImage2512Nudity.safetensors',
      wavespeed: 'https://huggingface.co/Sentinel7/qwen-image/resolve/main/2322700/2612959/NaturalBeautyQwenImage2512Nudity.safetensors',
      muapi: 'https://huggingface.co/Sentinel7/qwen-image/resolve/main/2322700/2612959/NaturalBeautyQwenImage2512Nudity.safetensors',
    },
    preferred: 'file',
    suggested_target: 'qwen-image-text-to-image-2512-lora (lora_list)',
    note: 'Photorealistic nudity/topless LoRA for Qwen-Image-2512. Descriptive triggers (see list). Subfolder file — full URL required everywhere.',
  },
  {
    id: 'Market5/Wan_2.2-2.1_POV_Missionary-high',
    name: 'POV Missionary-high (Wan2.1)',
    base_model: 'Wan-AI/Wan2.1-I2V-14B-720P',
    pipeline: 'video-generation',
    private: false,
    file: 'wan2.2_i2v_highnoise_pov_missionary_v1.0.safetensors',
    repo_url: 'https://huggingface.co/Market5/Wan_2.2-2.1_POV_Missionary-high',
    file_url: 'https://huggingface.co/Market5/Wan_2.2-2.1_POV_Missionary-high/resolve/main/wan2.2_i2v_highnoise_pov_missionary_v1.0.safetensors',
    suggested_target: 'wan2.1-lora-i2v (lora_list)',
    note: '80 downloads. Stamped Wan 2.1 I2V 720P. Fills lora_list as {path, scale}. 307 MB.',
  },
  {
    id: 'Market5/Double_Single_Handy_Blowjob',
    name: 'Single Handy (Wan2.1)',
    base_model: 'Wan-AI/Wan2.1-I2V-14B-480P',
    pipeline: 'video-generation',
    private: false,
    file: 'wan_dr34mj0b_t2v.safetensors',
    repo_url: 'https://huggingface.co/Market5/Double_Single_Handy_Blowjob',
    file_url: 'https://huggingface.co/Market5/Double_Single_Handy_Blowjob/resolve/main/wan_dr34mj0b_t2v.safetensors',
    suggested_target: 'wan2.1-lora-i2v (lora_list)',
    note: '36 downloads. Stamped Wan 2.1 I2V 480P. Fills lora_list as {path, scale}. 154 MB.',
  },
  {
    id: 'Market5/Assertive_Cowgirl',
    name: 'Assertive Cowgirl (Wan2.1)',
    base_model: 'Wan-AI/Wan2.1-I2V-14B-720P',
    pipeline: 'video-generation',
    private: false,
    file: 'Wan22-I2V-HIGH-Hip_Slammin_Assertive_Cowgirl.safetensors',
    repo_url: 'https://huggingface.co/Market5/Assertive_Cowgirl',
    file_url: 'https://huggingface.co/Market5/Assertive_Cowgirl/resolve/main/Wan22-I2V-HIGH-Hip_Slammin_Assertive_Cowgirl.safetensors',
    suggested_target: 'wan2.1-lora-i2v (lora_list)',
    note: '20 downloads. Stamped Wan 2.1 I2V 720P. Fills lora_list as {path, scale}. 307 MB.',
  },
];

// Run-verified LoRA ↔ model pairs. This is the single source of truth for the
// green "verified" tier in lora-compat.js: a pair appears green only if listed
// here. Add a row each time a combination completes a real generation.
//
//   { lora: '<hf owner/repo>', model: '<provider model id>', job: '<request id>', when: 'YYYY-MM-DD' }
//
export const VERIFIED_LORA_RUNS = [
  { lora: "D33pStateTech/d33pstateten", model: "krea-v2-turbo-lora", job: "840e36f8-d765-4966-8e9b-6f8dc4808053", when: "2026-09-20" },
  { lora: "D33pStateTech/aznten-Qwen-Image-2512-Lora-WaveSpeed-AI", model: "qwen-image-text-to-image-2512-lora", job: "4984353a-0796-4af1-84f9-00451b6f086c", when: "2026-09-19" },
];
