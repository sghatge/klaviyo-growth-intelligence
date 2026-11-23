const BASE_URL = "https://a.klaviyo.com/api";
export function isKlaviyoConfigured(){ return Boolean(process.env.KLAVIYO_PRIVATE_API_KEY); }
export async function klaviyoRequest<T>(path:string):Promise<T>{
 const key=process.env.KLAVIYO_PRIVATE_API_KEY;
 if(!key) throw new Error("Add a restricted Klaviyo private API key in server environment variables.");
 const response=await fetch(`${BASE_URL}${path}`,{headers:{Authorization:`Klaviyo-API-Key ${key}`,accept:"application/vnd.api+json",revision:process.env.KLAVIYO_API_REVISION||"2026-10-15"},cache:"no-store"});
 if(!response.ok) throw new Error(`Klaviyo API returned ${response.status}: ${(await response.text()).slice(0,180)}`);
 return response.json() as Promise<T>;
}
