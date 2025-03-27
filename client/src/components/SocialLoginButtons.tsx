import { Button } from "@/components/ui/button";
import { FaGoogle, FaFacebook, FaMicrosoft } from 'react-icons/fa';

interface SocialLoginButtonsProps {
  className?: string;
}

export default function SocialLoginButtons({ className = "" }: SocialLoginButtonsProps) {
  const handleSocialLogin = (provider: string) => {
    // Redirect to the server's OAuth route
    window.location.href = `/api/auth/${provider}`;
  };

  return (
    <div className={`flex flex-col space-y-3 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <Button
          variant="outline"
          type="button"
          onClick={() => handleSocialLogin("google")}
          className="bg-white text-black hover:bg-gray-100 border-gray-300"
        >
          <FaGoogle className="mr-2 h-4 w-4 text-red-500" />
          Google
        </Button>
        
        <Button
          variant="outline"
          type="button"
          onClick={() => handleSocialLogin("facebook")}
          className="bg-[#1877F2] text-white hover:bg-[#166FE5] border-[#1877F2]"
        >
          <FaFacebook className="mr-2 h-4 w-4" />
          Facebook
        </Button>
        
        <Button
          variant="outline"
          type="button"
          onClick={() => handleSocialLogin("microsoft")}
          className="bg-white text-black hover:bg-gray-100 border-gray-300"
        >
          <FaMicrosoft className="mr-2 h-4 w-4 text-[#00A4EF]" />
          Microsoft
        </Button>
      </div>
    </div>
  );
}