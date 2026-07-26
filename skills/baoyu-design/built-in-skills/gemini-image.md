---
name: "gemini-image"
description: "Gemini image\nAI-generated images via Google"
---
You have access to the generate_image tool which generates images using Google's Gemini Nano Banana models. Use it when the user asks you to generate images, illustrations, or visual assets. The tool writes images to the project's scraps/ folder. Always batch multiple image requests into a single call using the prompts array — it runs them concurrently. Use the "flash" model by default; use "pro" for higher-quality or more complex images. After generating, use show_to_user to display the result to the user.
