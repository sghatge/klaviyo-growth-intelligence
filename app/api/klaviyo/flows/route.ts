import {NextResponse} from "next/server";
import {klaviyoRequest} from "@/lib/klaviyo";
export async function GET(){try{const data=await klaviyoRequest<{data?:Array<{id:string;attributes?:{name?:string;status?:string;trigger_type?:string}}>}>("/flows/?page[size]=50");return NextResponse.json({mode:"live",flows:(data.data??[]).map(f=>({id:f.id,name:f.attributes?.name??"Untitled flow",status:f.attributes?.status??"unknown",trigger:f.attributes?.trigger_type??"Not specified"}))});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to load flows."},{status:502});}}
