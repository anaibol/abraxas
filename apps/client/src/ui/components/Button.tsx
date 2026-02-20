import { Button as ChakraButton, type ButtonProps as ChakraButtonProps } from "@chakra-ui/react";
import React from "react";
import { useAudio } from "../../contexts/AudioContext";

type ButtonProps = ChakraButtonProps & {
  disableSound?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ disableSound, onClick, onMouseEnter, ...props }, ref) => {
    const { playUIClick, playUIHover } = useAudio();

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disableSound && !props.disabled) {
        playUIHover?.();
      }
      onMouseEnter?.(e);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disableSound && !props.disabled) {
        playUIClick?.();
      }
      onClick?.(e);
    };

    return (
      <ChakraButton
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
        transition="all 0.15s cubic-bezier(0.16, 1, 0.3, 1)"
        _hover={{ transform: "translateY(-1px) scale(1.02)" }}
        _active={{ transform: "scale(0.96)" }}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
