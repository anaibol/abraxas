import { Button as ChakraButton, type ButtonProps as ChakraButtonProps } from "@chakra-ui/react";
import React from "react";

export type ButtonProps = ChakraButtonProps & {
  disableSound?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ disableSound, onClick, onMouseEnter, ...props }, ref) => {
    
    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disableSound && !props.disabled) {
        window.playUIHover?.();
      }
      onMouseEnter?.(e);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disableSound && !props.disabled) {
        window.playUIClick?.();
      }
      onClick?.(e);
    };

    return (
      <ChakraButton
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
