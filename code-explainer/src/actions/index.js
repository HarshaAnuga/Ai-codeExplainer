"use server";

export async function explain( prevState,formData){
    const code=formData.get("code");
    const language=formData.get("language");
    console.log(`Generating explanation for ${language}`);
    try{
        const res= await fetch(`${import.meta.env.VITE_API_BASE_URL}/explain-code`,{
            method:"POST",
            headers:{"Content-Type": "application/json"},
                body:JSON.stringify({code,language}),

           });

        if(!res.ok){
            return{
                sucess:false,
                error:`Failed to fetch the results`,
            }
        }
         const data =await res.json();
            return{
                sucess:true,
                data,
            };
        }catch(err){
            return{
                sucess:false,
                error:`An Error Occurred:${err?.message}`,
            };

        }
    }

