/**
 * WaveSpeed LoRA Quick Picker — HuggingFace
 * Shows HF LoRAs discovered via API and lets user copy/fill LoRA fields for current model.
 * Supports multiple LoRA field names: loras (array), lora_url, lora_list, etc.
 */
(function(){
  const USER_LORAS = [
    {
      "id": "Norod78/Flux_1_Dev_LoRA_Paper-Cutout-Style",
      "name": "Paper Cutout Style (FLUX.1-dev)",
      "base_model": "black-forest-labs/FLUX.1-dev",
      "pipeline": "text-to-image",
      "private": false,
      "file": "Flux_1_Dev_LoRA_Paper-Cutout-Style.safetensors",
      "repo_url": "https://huggingface.co/Norod78/Flux_1_Dev_LoRA_Paper-Cutout-Style",
      "file_url": "https://huggingface.co/Norod78/Flux_1_Dev_LoRA_Paper-Cutout-Style/resolve/main/Flux_1_Dev_LoRA_Paper-Cutout-Style.safetensors",
      "suggested_target": "flux-dev-lora / flux-1-dev-style-lora-inference (lora_url)",
      "note": "Flat paper-craft aesthetic. No trigger word. 172 MB."
    },
    {
      "id": "fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA",
      "name": "Multiple Angles (Qwen-Image-Edit-2511)",
      "base_model": "Qwen/Qwen-Image-Edit-2511",
      "pipeline": "image-to-image",
      "private": false,
      "file": "qwen-image-edit-2511-multiple-angles-lora.safetensors",
      "repo_url": "https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA",
      "file_url": "https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA/resolve/main/qwen-image-edit-2511-multiple-angles-lora.safetensors",
      "suggested_target": "qwen-image-edit lora slots (lora_list)",
      "note": "Camera-angle control for edit pipelines. No trigger word. 295 MB. Apache-2.0."
    },
    {
      "id": "Wuli-art/Qwen-Image-2512-Turbo-LoRA",
      "name": "Turbo 4-step (Qwen-Image-2512)",
      "base_model": "Qwen/Qwen-Image-2512",
      "pipeline": "text-to-image",
      "private": false,
      "strength": "1.0",
      "file": "Wuli-Qwen-Image-2512-Turbo-LoRA-4steps-V3.0-bf16.safetensors",
      "repo_url": "https://huggingface.co/Wuli-art/Qwen-Image-2512-Turbo-LoRA",
      "file_url": "https://huggingface.co/Wuli-art/Qwen-Image-2512-Turbo-LoRA/resolve/main/Wuli-Qwen-Image-2512-Turbo-LoRA-4steps-V3.0-bf16.safetensors",
      "preferred": "file",
      "suggested_target": "qwen-image-text-to-image-2512-lora (lora_list)",
      "note": "Step-distilled for 4-step sampling. Pair with a matching low step count. 1.2 GB. Apache-2.0."
    },
    {
      "id": "gokaygokay/Krea-2-Realism-LoRA",
      "name": "Realism (Krea-2-Raw)",
      "base_model": "krea/Krea-2-Raw",
      "pipeline": "text-to-image",
      "private": false,
      "file": "krea2_realism_lora.safetensors",
      "repo_url": "https://huggingface.co/gokaygokay/Krea-2-Realism-LoRA",
      "file_url": "https://huggingface.co/gokaygokay/Krea-2-Realism-LoRA/resolve/main/krea2_realism_lora.safetensors",
      "suggested_target": "krea raw / large lora slots (loras)",
      "note": "Photorealism bias for the Raw checkpoint. No trigger word. 469 MB."
    },
    {
      "id": "lvladikov/Krea2-Turbo-Distill-4step-LoRA",
      "name": "Turbo Distill 4-step (Krea-2-Turbo)",
      "base_model": "krea/Krea-2-Turbo",
      "pipeline": "text-to-image",
      "private": false,
      "strength": "1.0",
      "file": "krea2_turbo_4step_rank_64_lora.safetensors",
      "repo_url": "https://huggingface.co/lvladikov/Krea2-Turbo-Distill-4step-LoRA",
      "file_url": "https://huggingface.co/lvladikov/Krea2-Turbo-Distill-4step-LoRA/resolve/main/krea2_turbo_4step_rank_64_lora.safetensors",
      "preferred": "file",
      "suggested_target": "krea-v2-turbo-lora (loras)",
      "note": "Step distillation for the Turbo checkpoint. No trigger word. 438 MB."
    },
    {
      "id": "jasbloom/Wan2.1-I2V-14B-720P-Diffusers-mmxxii-rank256-lora",
      "name": "mmxxii rank256 (Wan2.1 I2V 720P)",
      "base_model": "Wan-AI/Wan2.1-I2V-14B-720P-Diffusers",
      "pipeline": "video-generation",
      "private": false,
      "file": "Wan2.1-I2V-14B-720P-Diffusers-mmxxii-rank256.safetensors",
      "repo_url": "https://huggingface.co/jasbloom/Wan2.1-I2V-14B-720P-Diffusers-mmxxii-rank256-lora",
      "file_url": "https://huggingface.co/jasbloom/Wan2.1-I2V-14B-720P-Diffusers-mmxxii-rank256-lora/resolve/main/Wan2.1-I2V-14B-720P-Diffusers-mmxxii-rank256.safetensors",
      "suggested_target": "wan2.1-lora-i2v (lora_list)",
      "note": "Style adapter for Wan 2.1 image-to-video at 720P. No trigger word. 2.9 GB."
    },
    {
      "id": "D33pStateTech/aznten-flux.1-dev-replicate",
      "name": "aznten-flux.1-dev-replicate",
      "base_model": "black-forest-labs/FLUX.1-dev",
      "pipeline": "text-to-image",
      "private": false,
      "instance_prompt": "aznten",
      "file": "aznten-flux.1-dev-replicate_Lora.safetensors",
      "repo_url": "https://huggingface.co/D33pStateTech/aznten-flux.1-dev-replicate",
      "file_url": "https://huggingface.co/D33pStateTech/aznten-flux.1-dev-replicate/resolve/main/aznten-flux.1-dev-replicate_Lora.safetensors",
      "suggested_target": "flux-1-dev-style-lora-inference (lora_url) / aznten_replicate (extra_lora)",
      "replicate_model": "d33pstatetech-stack/aznten_replicate",
      "muapi_model": "flux-1-dev-style-lora-inference",
      "note": "FLUX.1-dev LoRA, trigger 'aznten'. Use as lora_url on MuAPI or extra_lora on Replicate AZNTEN (model=dev)."
    },
    {
      "id": "D33pStateTech/aznten-flux-schnell-mimicpc",
      "name": "aznten-flux-schnell-mimicpc",
      "base_model": "black-forest-labs/FLUX.1-schnell",
      "pipeline": "text-to-image",
      "private": false,
      "instance_prompt": "aznten",
      "file": "aznten-flux-schnell-mimicpc.safetensors",
      "repo_url": "https://huggingface.co/D33pStateTech/aznten-flux-schnell-mimicpc",
      "file_url": "https://huggingface.co/D33pStateTech/aznten-flux-schnell-mimicpc/resolve/main/aznten-flux-schnell-mimicpc.safetensors",
      "suggested_target": "aznten_replicate (model=schnell, extra_lora)",
      "replicate_model": "d33pstatetech-stack/aznten_replicate",
      "muapi_model": "flux-schnell",
      "note": "FLUX.1-schnell LoRA, trigger 'aznten'. Checkpoint variant aznten-flux-schnell-mimicpc-000004.safetensors also in repo. Use as extra_lora with model=schnell."
    },
    {
      "id": "D33pStateTech/aznten-Qwen-Image-2512-Lora-WaveSpeed-AI",
      "name": "aznten-Qwen-Image-2512-Lora-WaveSpeed-AI",
      "base_model": "Qwen/Qwen-Image-2512",
      "pipeline": "text-to-image",
      "private": false,
      "instance_prompt": "aznten",
      "file": "aznten-Qwen-Image-2512-Lora-WaveSpeed-AI.safetensors",
      "repo_url": "https://huggingface.co/D33pStateTech/aznten-Qwen-Image-2512-Lora-WaveSpeed-AI",
      "file_url": "https://huggingface.co/D33pStateTech/aznten-Qwen-Image-2512-Lora-WaveSpeed-AI/resolve/main/aznten-Qwen-Image-2512-Lora-WaveSpeed-AI.safetensors",
      "suggested_target": "qwen-image-text-to-image-2512-lora (loras)",
      "replicate_model": "qwen/qwen-image",
      "muapi_model": "qwen-image-text-to-image-2512-lora",
      "note": "Qwen-Image-2512 LoRA, trigger 'aznten'. For MuAPI use qwen-image-text-to-image-2512-lora ΓåÆ loras: [{\"path\":\"...\",\"scale\":1}]. For Replicate use qwen/qwen-image ΓåÆ lora_weights."
    },
    {
      "id": "D33pStateTech/d33pstateten",
      "name": "d33pstateten",
      "base_model": "krea/Krea-2-Raw",
      "pipeline": "text-to-image",
      "private": false,
      "instance_prompt": "aznten",
      "file": "pytorch_lora_weights.safetensors",
      "repo_url": "https://huggingface.co/D33pStateTech/d33pstateten",
      "file_url": "https://huggingface.co/D33pStateTech/d33pstateten/resolve/main/pytorch_lora_weights.safetensors",
      "suggested_target": "krea-v2-turbo-lora (loras) or any Krea-2 via diffusers",
      "replicate_model": "krea/krea-2-large",
      "muapi_model": "krea-v2-turbo-lora",
      "note": "Krea-2-Raw LoRA, trigger aznten. Public repo. For MuAPI use krea-v2-turbo-lora ΓåÆ loras: [{\"path\":\"...\",\"scale\":1}]"
    },
    {
      "id": "D33pStateTech/d33pstateLora",
      "name": "d33pstateLora",
      "base_model": "black-forest-labs/FLUX.1-dev",
      "pipeline": "text-to-image",
      "private": false,
      "instance_prompt": "asian ten",
      "file": "flux-asian-ten-v2-000024.safetensors",
      "repo_url": "https://huggingface.co/D33pStateTech/d33pstateLora",
      "file_url": "https://huggingface.co/D33pStateTech/d33pstateLora/resolve/main/flux-asian-ten-v2-000024.safetensors",
      "suggested_target": "flux-dev-lora or flux-1-dev-style-lora-inference (lora_url) / aznten_replicate (extra_lora)",
      "muapi_model": "flux-1-dev-style-lora-inference",
      "note": "FLUX.1-dev LoRA, trigger 'asian ten'. Use as lora_url on MuAPI or extra_lora on Replicate AZNTEN."
    },
    {
      "id": "D33pStateTech/asian-ten-wan21-lora",
      "name": "asian-ten-wan21-lora",
      "base_model": "Wan-AI/Wan2.1-T2V-14B",
      "pipeline": "video-generation",
      "private": false,
      "instance_prompt": "",
      "file": "asian_ten_wan21.safetensors",
      "repo_url": "https://huggingface.co/D33pStateTech/asian-ten-wan21-lora",
      "file_url": "https://huggingface.co/D33pStateTech/asian-ten-wan21-lora/resolve/main/asian_ten_wan21.safetensors",
      "suggested_target": "wan2.1-lora-t2v / wan2.1-lora-i2v / wavespeedai/wan-2.1-t2v-480p (lora_weights)",
      "muapi_model": "wan2.1-lora-t2v",
      "note": "Wan2.1 T2V LoRA ΓÇö use as lora_weights on wavespeedai/wan-2.1-t2v-480p or MuAPI wan2.1-lora-*"
    }
  ]

  // NSFW LoRA library — only adapters runnable on a LoRA endpoint (18+ only).
  // FLUX.1-dev entries → flux-1-dev-style-lora-inference (lora_url).
  // Wan 2.1 I2V entries → wan2.1-lora-i2v (lora_list).
  // Wan 2.2 / unstamped entries have no known WaveSpeed LoRA endpoint — excluded.
  const NSFW_LORAS = [
    {
      "id": "xey/sldr_flux_nsfw_v2-studio",
      "name": "sldr_flux_nsfw_v2-studio",
      "base_model": "black-forest-labs/FLUX.1-dev",
      "pipeline": "text-to-image",
      "private": false,
      "file": "sldr_flux_nsfw_v2-studio.safetensors",
      "repo_url": "https://huggingface.co/xey/sldr_flux_nsfw_v2-studio",
      "file_url": "https://huggingface.co/xey/sldr_flux_nsfw_v2-studio/resolve/main/sldr_flux_nsfw_v2-studio.safetensors",
      "replicate_model": "d33pstatetech-stack/aznten_replicate",
      "suggested_target": "flux-1-dev-style-lora-inference (lora_url)",
      "note": "307 likes · 1.1M downloads. Photorealistic-oriented adapter. No documented trigger. 687 MB."
    },
    {
      "id": "lustlyai/Flux_Lustly.ai_Uncensored_nsfw_v1",
      "name": "Flux_Lustly.ai_Uncensored_nsfw_v1",
      "base_model": "black-forest-labs/FLUX.1-dev",
      "pipeline": "text-to-image",
      "private": false,
      "file": "flux_lustly-ai_v1.safetensors",
      "repo_url": "https://huggingface.co/lustlyai/Flux_Lustly.ai_Uncensored_nsfw_v1",
      "file_url": "https://huggingface.co/lustlyai/Flux_Lustly.ai_Uncensored_nsfw_v1/resolve/main/flux_lustly-ai_v1.safetensors",
      "replicate_model": "d33pstatetech-stack/aznten_replicate",
      "suggested_target": "flux-1-dev-style-lora-inference (lora_url)",
      "note": "275 likes · 155.5K downloads. General uncensored adapter. No trigger word. 344 MB."
    },
    {
      "id": "lexa862/NSFWmodel",
      "name": "NSFWmodel",
      "base_model": "black-forest-labs/FLUX.1-dev",
      "pipeline": "text-to-image",
      "private": false,
      "instance_prompt": "Nude",
      "file": "NSFW_master.safetensors",
      "repo_url": "https://huggingface.co/lexa862/NSFWmodel",
      "file_url": "https://huggingface.co/lexa862/NSFWmodel/resolve/main/NSFW_master.safetensors",
      "replicate_model": "d33pstatetech-stack/aznten_replicate",
      "suggested_target": "flux-1-dev-style-lora-inference (lora_url)",
      "note": "78 likes · 459.7K downloads. Trigger 'Nude'. 172 MB, permissive unlicense."
    },
    {
      "id": "Keltezaa/NSFW_MASTER_FLUX",
      "name": "NSFW_MASTER_FLUX",
      "base_model": "black-forest-labs/FLUX.1-dev",
      "pipeline": "text-to-image",
      "private": false,
      "instance_prompt": "NSFW",
      "triggers": [
        "NSFW",
        "Nude"
      ],
      "file": "NSFW_master_Flux.safetensors",
      "repo_url": "https://huggingface.co/Keltezaa/NSFW_MASTER_FLUX",
      "file_url": "https://huggingface.co/Keltezaa/NSFW_MASTER_FLUX/resolve/main/NSFW_master_Flux.safetensors",
      "replicate_model": "d33pstatetech-stack/aznten_replicate",
      "suggested_target": "flux-1-dev-style-lora-inference (lora_url)",
      "note": "68 likes · 30.3K downloads. Triggers 'NSFW' or 'Nude'. 172 MB. MIT."
    },
    {
      "id": "imagepipeline/flux_uncensored_nsfw_v2",
      "name": "flux_uncensored_nsfw_v2",
      "base_model": "black-forest-labs/FLUX.1-dev",
      "pipeline": "text-to-image",
      "private": false,
      "file": "lora.safetensors",
      "repo_url": "https://huggingface.co/imagepipeline/flux_uncensored_nsfw_v2",
      "file_url": "https://huggingface.co/imagepipeline/flux_uncensored_nsfw_v2/resolve/main/lora.safetensors",
      "replicate_model": "d33pstatetech-stack/aznten_replicate",
      "suggested_target": "flux-1-dev-style-lora-inference (lora_url)",
      "note": "34 likes · 33.1K downloads. Tagged ultra-realistic. No documented trigger. 687 MB."
    },
    {
      "id": "starsfriday/Qwen-Image-NSFW",
      "name": "Qwen-Image-NSFW (Qwen)",
      "base_model": "Qwen-Image-2512",
      "pipeline": "text-to-image",
      "private": false,
      "instance_prompt": "rsq",
      "triggers": [
        "rsq"
      ],
      "strength": "0.6–1.0",
      "file": "qwen_image_nsfw.safetensors",
      "repo_url": "https://huggingface.co/starsfriday/Qwen-Image-NSFW",
      "file_url": "https://huggingface.co/starsfriday/Qwen-Image-NSFW/resolve/main/qwen_image_nsfw.safetensors",
      "formats": {
        "replicate": "huggingface.co/starsfriday/Qwen-Image-NSFW",
        "wavespeed": "starsfriday/Qwen-Image-NSFW",
        "muapi": "https://huggingface.co/starsfriday/Qwen-Image-NSFW/resolve/main/qwen_image_nsfw.safetensors"
      },
      "preferred": "file",
      "suggested_target": "qwen-image-text-to-image-2512-lora (lora_list)",
      "note": "General uncensored adapter for Qwen-Image-2512. Trigger 'rsq'. Pair with strength 0.6–1.0."
    },
    {
      "id": "Sentinel7/qwen-image-qwen4play",
      "name": "Qwen4Play 2512 v1/v2 (Qwen)",
      "base_model": "Qwen-Image-2512",
      "pipeline": "text-to-image",
      "private": false,
      "instance_prompt": "bl0wj0b",
      "triggers": [
        "bl0wj0b",
        "c0wg1rl"
      ],
      "strength": "0.8–1.0",
      "file": "Qwen4Play-2512.1_e10.safetensors",
      "repo_url": "https://huggingface.co/Sentinel7/qwen-image",
      "file_url": "https://huggingface.co/Sentinel7/qwen-image/resolve/main/2004155/2611939/Qwen4Play-2512.1_e10.safetensors",
      "civitai": "civitai:2004155@2611939",
      "formats": {
        "replicate": "https://huggingface.co/Sentinel7/qwen-image/resolve/main/2004155/2611939/Qwen4Play-2512.1_e10.safetensors",
        "wavespeed": "https://huggingface.co/Sentinel7/qwen-image/resolve/main/2004155/2611939/Qwen4Play-2512.1_e10.safetensors",
        "muapi": "civitai:2004155@2611939"
      },
      "preferred": "file",
      "suggested_target": "qwen-image-text-to-image-2512-lora (lora_list)",
      "note": "Act-specific LoRA (Civitai mirror). Subfolder file — full URL required on WaveSpeed/Replicate; civitai: shorthand preferred on MuAPI. Triggers vary by act, or none required."
    },
    {
      "id": "Sentinel7/qwen-image-naturalbeauty",
      "name": "NaturalBeauty Nudity (Qwen)",
      "base_model": "Qwen-Image-2512",
      "pipeline": "text-to-image",
      "private": false,
      "instance_prompt": "naked",
      "triggers": [
        "naked",
        "topless"
      ],
      "strength": "0.6–1.0",
      "file": "NaturalBeautyQwenImage2512Nudity.safetensors",
      "repo_url": "https://huggingface.co/Sentinel7/qwen-image",
      "file_url": "https://huggingface.co/Sentinel7/qwen-image/resolve/main/2322700/2612959/NaturalBeautyQwenImage2512Nudity.safetensors",
      "formats": {
        "replicate": "https://huggingface.co/Sentinel7/qwen-image/resolve/main/2322700/2612959/NaturalBeautyQwenImage2512Nudity.safetensors",
        "wavespeed": "https://huggingface.co/Sentinel7/qwen-image/resolve/main/2322700/2612959/NaturalBeautyQwenImage2512Nudity.safetensors",
        "muapi": "https://huggingface.co/Sentinel7/qwen-image/resolve/main/2322700/2612959/NaturalBeautyQwenImage2512Nudity.safetensors"
      },
      "preferred": "file",
      "suggested_target": "qwen-image-text-to-image-2512-lora (lora_list)",
      "note": "Photorealistic nudity/topless LoRA for Qwen-Image-2512. Descriptive triggers (see list). Subfolder file — full URL required everywhere."
    },
    {
      "id": "Market5/Wan_2.2-2.1_POV_Missionary-high",
      "name": "POV Missionary-high (Wan2.1)",
      "base_model": "Wan-AI/Wan2.1-I2V-14B-720P",
      "pipeline": "video-generation",
      "private": false,
      "file": "wan2.2_i2v_highnoise_pov_missionary_v1.0.safetensors",
      "repo_url": "https://huggingface.co/Market5/Wan_2.2-2.1_POV_Missionary-high",
      "file_url": "https://huggingface.co/Market5/Wan_2.2-2.1_POV_Missionary-high/resolve/main/wan2.2_i2v_highnoise_pov_missionary_v1.0.safetensors",
      "suggested_target": "wan2.1-lora-i2v (lora_list)",
      "note": "80 downloads. Stamped Wan 2.1 I2V 720P. Fills lora_list as {path, scale}. 307 MB."
    },
    {
      "id": "Market5/Double_Single_Handy_Blowjob",
      "name": "Single Handy (Wan2.1)",
      "base_model": "Wan-AI/Wan2.1-I2V-14B-480P",
      "pipeline": "video-generation",
      "private": false,
      "file": "wan_dr34mj0b_t2v.safetensors",
      "repo_url": "https://huggingface.co/Market5/Double_Single_Handy_Blowjob",
      "file_url": "https://huggingface.co/Market5/Double_Single_Handy_Blowjob/resolve/main/wan_dr34mj0b_t2v.safetensors",
      "suggested_target": "wan2.1-lora-i2v (lora_list)",
      "note": "36 downloads. Stamped Wan 2.1 I2V 480P. Fills lora_list as {path, scale}. 154 MB."
    },
    {
      "id": "Market5/Assertive_Cowgirl",
      "name": "Assertive Cowgirl (Wan2.1)",
      "base_model": "Wan-AI/Wan2.1-I2V-14B-720P",
      "pipeline": "video-generation",
      "private": false,
      "file": "Wan22-I2V-HIGH-Hip_Slammin_Assertive_Cowgirl.safetensors",
      "repo_url": "https://huggingface.co/Market5/Assertive_Cowgirl",
      "file_url": "https://huggingface.co/Market5/Assertive_Cowgirl/resolve/main/Wan22-I2V-HIGH-Hip_Slammin_Assertive_Cowgirl.safetensors",
      "suggested_target": "wan2.1-lora-i2v (lora_list)",
      "note": "20 downloads. Stamped Wan 2.1 I2V 720P. Fills lora_list as {path, scale}. 307 MB."
    }
  ]

  function copyText(t, label){
    navigator.clipboard.writeText(t).then(()=> {
      if(window.showToast) showToast(label + ' copied', 'success');
      else alert(label + ' copied');
    });
  }

  function findLoraFieldForCurrentModel(){
    // Try to detect currentSchema (from window.currentSchema or app.js globals)
    const schema = window.currentSchema || null;
    if(!schema || !schema.params) return null;
    const params = schema.params;
    // Priority order for lora fields (schema-detected, provider-agnostic)
    const candidates = [
      {key:'loras', type:'array'}, // krea-v2-turbo-lora
      {key:'lora_url', type:'string'}, // flux-1-dev-style-lora-inference
      {key:'lora_list', type:'array'}, // flux-2-klein
      {key:'lora_weights', type:'string'}, // wavespeed
      {key:'extra_lora', type:'string'},
      {key:'lora_scale', type:'number'},
    ];
    for(const c of candidates){
      if(params[c.key]){
        return c.key;
      }
    }
    // Fallback: any key containing lora
    for(const k of Object.keys(params)){
      if(k.toLowerCase().includes('lora')){
        return k;
      }
    }
    return null;
  }

  function fillLoraForCurrentModel(repoUrl, fileUrl){
    const curModel = window.currentModel;
    const field = findLoraFieldForCurrentModel();
    if(!curModel){
      copyText(repoUrl, 'Repo URL');
      if(window.showToast) showToast('Select a model first — copied repo URL', 'error');
      return;
    }
    if(!field){
      copyText(repoUrl, 'Repo URL');
      if(window.showToast) showToast('No LoRA field for this model — copied repo URL', 'error');
      return;
    }
    // Determine value to fill based on field type
    const schema = window.currentSchema;
    const spec = schema.params[field];
    let valueToFill = repoUrl;
    let displayLabel = field;

    // Handle array types (loras, lora_list)
    if(spec && spec.type==='array'){
      // For loras/lora_list: expected [{path: url, scale: 1.0}]
      // The path must resolve to weights — prefer the direct
      // .safetensors file URL over the repo page URL (a repo page
      // URL fails or hangs at LoRA download). Works for both Fill
      // buttons since we pick whichever arg is the direct file.
      const scale = 1.0;
      const direct = [repoUrl, fileUrl].find(u => u && /\.safetensors(\?|#|$)/i.test(u)) || repoUrl;
      valueToFill = [{ path: direct, scale: scale }];
    } else if(spec && spec.type==='string'){
      // For lora_url, lora_weights, extra_lora
      // Use repo_url (or file_url if the field expects direct file)
      // For wavespeedai, lora_weights can be HF repo URL
      // For flux-1-dev-style-lora-inference, lora_url expects direct .safetensors URL? The description says "The LoRA file URL" — could be direct.
      // We'll use file_url for direct file fields, repo_url for repo fields
      // Heuristic: if field is lora_weights or lora_url and file_url ends with .safetensors, use file_url for direct
      if(field==='lora_weights' || field==='lora_url'){
        // Prefer file_url if available and field description mentions file URL
        // But repo_url also works for many. We'll use file_url for direct to be safe, but also provide repo_url as alternative
        // Default to repo_url for compatibility, but if user wants file, they can copy file_url
        valueToFill = fileUrl || repoUrl;
      } else {
        valueToFill = repoUrl;
      }
    }

    // Try to set via currentParams and UI
    // currentParams is object, and renderParams handles array vs string
    // We need to set window.currentParams[field] and re-render
    try{
      if(window.currentParams){
        window.currentParams[field] = valueToFill;
      }
      // Try to find input element for that field
      // For array fields, the UI may be more complex (e.g., loras is array, renders as???)
      // For now, just update currentParams and refresh payload preview
      if(window.updatePayloadPreview) window.updatePayloadPreview();
      // Try to find and update the input element if it exists
      const input = document.querySelector(`[data-param="${field}"]`);
      if(input){
        if(input.tagName==='SELECT'){
          // not expected for lora
        } else if(input.type==='checkbox'){
          // no
        } else {
          // For string fields, set value
          if(typeof valueToFill === 'string'){
            input.value = valueToFill;
            input.dispatchEvent(new Event('input', {bubbles:true}));
            input.dispatchEvent(new Event('change', {bubbles:true}));
          } else if(Array.isArray(valueToFill)){
            // Array fields render as slot rows (text + strength slider each).
            // Fill the first empty slot so strength stays adjustable.
            const slots = Array.from(document.querySelectorAll(`input[data-param="${field}"][data-lora-slot]`));
            const target = slots.find((s) => !s.value.trim()) || slots[0];
            if (target && valueToFill[0]) {
              target.value = valueToFill[0].path || '';
              target.dispatchEvent(new Event('input', { bubbles: true }));
              target.dispatchEvent(new Event('change', { bubbles: true }));
              if(window.showToast) showToast(`Filled ${field} slot with LoRA (strength adjustable)`, 'success');
              return;
            }
            // No slot UI (older render) — copy the JSON for manual paste
            copyText(JSON.stringify(valueToFill), field);
            if(window.showToast) showToast(`Filled ${field} with LoRA array — also copied JSON`, 'success');
            return;
          }
        }
        input.focus();
        input.select();
      }
      if(window.showToast) showToast(`Filled ${field} with LoRA`, 'success');
      // Also copy to clipboard for convenience
      // Don't auto-copy, just fill
    } catch(e){
      console.error(e);
      copyText(typeof valueToFill==='string'? valueToFill : JSON.stringify(valueToFill), field);
    }
  }

  function loraFamily(l){
    const b=String(l.base_model||'');
    if(/flux/i.test(b)) return 'FLUX.1';
    if(/qwen/i.test(b)) return 'Qwen-Image';
    if(/krea/i.test(b)) return 'Krea';
    if(/wan[-\s]?2\.1/i.test(b)) return 'Wan 2.1';
    if(/wan[-\s]?2\.2/i.test(b)) return 'Wan 2.2';
    if(/wan/i.test(b)) return 'Wan (other)';
    return 'Other / unstamped';
  }
  function loraGroupLabel(l){ return (l.pipeline==='video-generation'?'🎬 Video — ':'🖼 Image — ') + loraFamily(l); }
  const LORA_FAM_ORDER={'FLUX.1':0,'Qwen-Image':1,'Krea':2,'Wan 2.1':3,'Wan 2.2':4,'Wan (other)':5,'Other / unstamped':6};
  function nsfwSort(a,b){
    const ap=a.pipeline==='video-generation'?1:0, bp=b.pipeline==='video-generation'?1:0;
    if(ap!==bp) return ap-bp;
    const af=LORA_FAM_ORDER[loraFamily(a)]??9, bf=LORA_FAM_ORDER[loraFamily(b)]??9;
    if(af!==bf) return af-bf;
    return String(a.name||'').localeCompare(String(b.name||''));
  }
  function loraTriggers(l){
    if(Array.isArray(l.triggers)&&l.triggers.length) return l.triggers;
    if(l.instance_prompt) return [l.instance_prompt];
    return [];
  }
  function svcFormats(l){
    const out=[];
    if(l.formats&&l.formats.replicate) out.push(['R','replicate',l.formats.replicate]);
    if(l.formats&&l.formats.wavespeed) out.push(['W','wavespeed',l.formats.wavespeed]);
    const m=(l.formats&&l.formats.muapi)||l.civitai;
    if(m) out.push(['M','muapi',m]);
    return out;
  }
  function escQ(s){ return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }
  function renderLoraListInto(listId, loras, hintId, grouped){
    const list = document.getElementById(listId);
    const hint = hintId ? document.getElementById(hintId) : null;
    if(!list || !loras) return;
    if(grouped) loras=[...loras].sort(nsfwSort);
    let lastGroup=null;
    list.innerHTML = loras.map(l => {
      let head='';
      if(grouped){ const g=loraGroupLabel(l); if(g!==lastGroup){ lastGroup=g; head=`<div class="text-[11px] font-bold text-gray-300 mt-3 mb-1 px-1">${g}</div>`; } }
      const trigs=loraTriggers(l);
      const svc=svcFormats(l);
      const pref=l.preferred||'docs';
      const star=k=>pref===k?'★ ':'';
      const prefCls=k=>pref===k?' !border-emerald-500 !text-emerald-300':'';
      const trigHtml=trigs.length
        ? trigs.map(t=>`<code class="text-[11px] font-bold bg-fuchsia-900/40 border border-fuchsia-700 text-fuchsia-300 px-1.5 py-0.5 rounded" title="trigger word — include in your prompt">${t}</code>`).join('')+`<button data-copy-trigger="${l.id}" class="icon-btn !w-6 !h-6" title="Copy trigger(s)"><i class="fas fa-copy text-[9px]"></i></button>`
        : `<span class="text-[10px] text-gray-600 italic">No trigger — general style</span>`;
      return head+`
      <div class="p-2 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-purple-600/50 transition-colors" title="${escQ(l.name)} — ${escQ(l.base_model)}">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-semibold text-gray-200 truncate" title="${escQ(l.name)}">${l.name}</span>
              ${l.private ? '<span class="text-[9px] bg-amber-900/50 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded-full">Private</span>' : '<span class="text-[9px] bg-emerald-900/30 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded-full">Public</span>'}
              <span class="text-[10px] text-gray-500 truncate" title="${escQ(l.base_model)}">${l.base_model}</span>
            </div>
            <div class="text-[10px] text-gray-500 mt-0.5 truncate" title="${escQ(l.id)} • ${escQ(l.file)}">${l.id} • ${l.file}</div>
            <div class="mt-1 flex items-center gap-1.5 flex-wrap">
              <span class="text-[10px] text-gray-500">Trigger${trigs.length>1?'s':''}:</span>
              ${trigHtml}
            </div>
            ${l.strength?`<div class="text-[10px] text-gray-500 mt-0.5">💪 suggested strength ${l.strength} · put trigger(s) in your prompt</div>`:''}
            <div class="text-[10px] text-gray-400 mt-1 line-clamp-2" title="${escQ(l.note)}">${l.note}</div>
            <div class="text-[10px] text-purple-300 mt-1" title="Recommended target">→ ${l.suggested_target}</div>
          </div>
          <span class="text-[10px] text-gray-600" title="${l.pipeline==='video-generation'?'Video LoRA':'Image LoRA'}">${l.pipeline==='video-generation' ? '<i class="fas fa-video"></i>' : '<i class="fas fa-image"></i>'}</span>
        </div>
        <div class="mt-2 space-y-1.5">
          <div class="flex gap-1 items-center">
            <span class="text-[9px] text-gray-500 w-14 shrink-0" title="HuggingFace owner/repo short form">HF short</span>
            <code class="flex-1 text-[10px] bg-gray-900 border border-gray-700 rounded px-2 py-1 truncate" title="${escQ(l.repo_url)}">${l.repo_url}</code>
            <button data-copy-repo="${l.id}" class="icon-btn !w-7 !h-7" title="Copy repo URL"><i class="fas fa-copy text-[10px]"></i></button>
            <button data-fill-repo="${l.id}" class="btn-primary-sm !px-2 !py-1 text-[10px]${prefCls('docs')}" title="${pref==='docs'?'★ Preferred format — fills first empty slot':'Fill short form'}">${star('docs')}Fill</button>
          </div>
          <div class="flex gap-1 items-center">
            <span class="text-[9px] text-gray-500 w-14 shrink-0" title="Direct .safetensors file URL">Direct file</span>
            <code class="flex-1 text-[10px] bg-gray-900 border border-gray-700 rounded px-2 py-1 truncate" title="${escQ(l.file_url)}">${l.file_url}</code>
            <button data-copy-file="${l.id}" class="icon-btn !w-7 !h-7" title="Copy .safetensors URL"><i class="fas fa-file text-[10px]"></i></button>
            <button data-fill-file="${l.id}" class="btn-secondary !px-2 !py-1 text-[10px]${prefCls('file')}" title="${pref==='file'?'★ Preferred format — fills first empty slot':'Fill direct file URL'}">${star('file')}Fill file</button>
          </div>
          ${svc.length?`<div class="flex gap-1 items-center flex-wrap"><span class="text-[9px] text-gray-500 w-14 shrink-0" title="Per-service recommended strings — click a chip to copy">Services</span>${svc.map(([tag,sname,val])=>`<button data-copy-svc="${l.id}|${sname}" class="btn-secondary !px-1.5 !py-0.5 text-[9px]" title="${sname}: ${escQ(val)} — click to copy">${tag}</button>`).join('')}<span class="text-[9px] text-gray-600">R=Replicate · W=WaveSpeed · M=MuAPI</span></div>`:''}
        </div>
      </div>
    `}).join('');
    if(hint) hint.classList.remove('hidden');
    // Wire events (scoped to this list container)
    list.querySelectorAll('[data-copy-repo]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id=btn.getAttribute('data-copy-repo');
        const l=loras.find(x=>x.id===id);
        if(l) copyText(l.repo_url, 'Repo URL');
      });
    });
    list.querySelectorAll('[data-copy-file]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id=btn.getAttribute('data-copy-file');
        const l=loras.find(x=>x.id===id);
        if(l) copyText(l.file_url, 'File URL');
      });
    });
    list.querySelectorAll('[data-copy-trigger]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id=btn.getAttribute('data-copy-trigger');
        const l=loras.find(x=>x.id===id);
        if(l){ const t=loraTriggers(l); if(t.length) copyText(t.join(', '), 'Trigger'+(t.length>1?'s':'')); }
      });
    });
    list.querySelectorAll('[data-copy-svc]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const parts=btn.getAttribute('data-copy-svc').split('|');
        const l=loras.find(x=>x.id===parts[0]);
        const svc=l?svcFormats(l).find(s=>s[1]===parts[1]):null;
        if(svc) copyText(svc[2], parts[1]+' LoRA string');
      });
    });
    list.querySelectorAll('[data-fill-repo]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id=btn.getAttribute('data-fill-repo');
        const l=loras.find(x=>x.id===id);
        if(l) fillLoraForCurrentModel(l.repo_url, l.file_url);
      });
    });
    list.querySelectorAll('[data-fill-file]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id=btn.getAttribute('data-fill-file');
        const l=loras.find(x=>x.id===id);
        if(l) fillLoraForCurrentModel(l.file_url, l.repo_url);
      });
    });
  }
  function renderLoraList(){ renderLoraListInto('loraListWs', (typeof USER_LORAS!=='undefined') ? USER_LORAS : [], 'loraHintWs'); }
  function renderNsfwLoraList(){ renderLoraListInto('nsfwLoraListWs', (typeof NSFW_LORAS!=='undefined') ? NSFW_LORAS : [], 'nsfwLoraHintWs', true); }

  function initLoraPicker(){
    const btn=document.getElementById('btnToggleLoraListWs');
    const list=document.getElementById('loraListWs');
    if(btn && list){
      btn.addEventListener('click', ()=>{
        const hidden=list.classList.contains('hidden');
        if(hidden){
          list.classList.remove('hidden');
          document.getElementById('loraHintWs')?.classList.remove('hidden');
          btn.innerHTML='<i class="fas fa-chevron-up mr-1"></i> Hide LoRAs';
          renderLoraList();
        } else {
          list.classList.add('hidden');
          document.getElementById('loraHintWs')?.classList.add('hidden');
          btn.innerHTML='<i class="fas fa-chevron-down mr-1"></i> Show LoRAs';
        }
      });
    }
    const nsfwBtn=document.getElementById('btnToggleNsfwLoraListWs');
    const nsfwList=document.getElementById('nsfwLoraListWs');
    if(nsfwBtn && nsfwList){
      nsfwBtn.addEventListener('click', ()=>{
        const hidden=nsfwList.classList.contains('hidden');
        if(hidden){
          nsfwList.classList.remove('hidden');
          document.getElementById('nsfwLoraHintWs')?.classList.remove('hidden');
          nsfwBtn.innerHTML='<i class="fas fa-chevron-up mr-1"></i> Hide NSFW LoRAs';
          renderNsfwLoraList();
        } else {
          nsfwList.classList.add('hidden');
          document.getElementById('nsfwLoraHintWs')?.classList.add('hidden');
          nsfwBtn.innerHTML='<i class="fas fa-chevron-down mr-1"></i> Show NSFW LoRAs';
        }
      });
    }
    // Re-render hint when model changes
    const origSelect = window.selectModel;
    if(origSelect){
      window.selectModel = async function(...a){
        const r=await origSelect(...a);
        if(list && !list.classList.contains('hidden')) renderLoraList();
        if(nsfwList && !nsfwList.classList.contains('hidden')) renderNsfwLoraList();
        return r;
      };
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initLoraPicker);
  else initLoraPicker();

  // Expose for debugging
  window.USER_LORAS = USER_LORAS;
  window.NSFW_LORAS = (typeof NSFW_LORAS!=='undefined') ? NSFW_LORAS : [];
})();
